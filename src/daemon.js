// Discord Rich Presence daemon for Claude Code. Zero dependencies; speaks Discord IPC directly.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { DATA, SESSIONS, PIDFILE, LOG, loadConfig, daemonPid } = require('./common');

const STALE_MS = 30 * 60 * 1000;          // a session with no events for 30 min is ignored
const EXIT_AFTER_IDLE_MS = 5 * 60 * 1000; // exit when no sessions for 5 min; the hook restarts us
const TICK_MS = 3000;

fs.mkdirSync(DATA, { recursive: true });
try { if (fs.statSync(LOG).size > 256 * 1024) fs.rmSync(LOG); } catch {}
const log = (...a) => { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${a.join(' ')}\n`); } catch {} };

// single instance
const other = daemonPid();
if (other && other !== process.pid) process.exit(0);
fs.writeFileSync(PIDFILE, String(process.pid));
process.on('exit', () => { try { if (fs.readFileSync(PIDFILE, 'utf8') == process.pid) fs.rmSync(PIDFILE); } catch {} });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(0));

// ---- Discord IPC ----
function socketCandidates() {
  if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const bases = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, '/tmp'].filter(Boolean);
  if (process.getuid) bases.push(`/run/user/${process.getuid()}`);
  const subs = ['', 'app/com.discordapp.Discord', 'app/com.discordapp.DiscordCanary', 'app/dev.vencord.Vesktop',
    'snap.discord', 'snap.discord-canary', '.flatpak/dev.vencord.Vesktop/xdg-run'];
  const out = [];
  for (const b of bases) for (const s of subs) for (let i = 0; i < 10; i++) {
    const p = path.join(b, s, `discord-ipc-${i}`);
    if (fs.existsSync(p)) out.push(p);
  }
  return [...new Set(out)];
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data));
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

class RPC {
  constructor(clientId) { this.clientId = clientId; this.sock = null; this.ready = false; this.buf = Buffer.alloc(0); }

  connect() {
    return new Promise((resolve, reject) => {
      const paths = socketCandidates();
      if (!paths.length) return reject(new Error('Discord IPC socket not found (is Discord running?)'));
      const tryAt = (i) => {
        if (i >= paths.length) return reject(new Error('could not connect to any Discord IPC socket'));
        const sock = net.createConnection(paths[i]);
        sock.once('error', () => tryAt(i + 1));
        sock.once('connect', () => {
          sock.removeAllListeners('error');
          this.sock = sock;
          const timer = setTimeout(() => { reject(new Error('handshake timed out')); this.close(); }, 10000);
          sock.on('data', (d) => this.onData(d, () => { clearTimeout(timer); resolve(); }, (e) => { clearTimeout(timer); reject(e); }));
          sock.on('error', (e) => { log('socket error', e.message); this.close(); });
          sock.on('close', () => { this.ready = false; this.sock = null; });
          sock.write(encode(0, { v: 1, client_id: this.clientId }));
        });
      };
      tryAt(0);
    });
  }

  onData(chunk, resolve, reject) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0);
      const len = this.buf.readInt32LE(4);
      if (this.buf.length < 8 + len) break;
      let msg = {};
      try { msg = JSON.parse(this.buf.subarray(8, 8 + len).toString()); } catch {}
      this.buf = this.buf.subarray(8 + len);
      if (op === 3) this.sock?.write(encode(4, msg));                // ping -> pong
      else if (op === 2) { log('discord closed:', JSON.stringify(msg)); reject(new Error(msg.message || 'closed')); this.close(); }
      else if (msg.evt === 'READY') { this.ready = true; log('connected as', msg.data?.user?.username); resolve(); }
      else if (msg.evt === 'ERROR') log('rpc error:', JSON.stringify(msg.data));
    }
  }

  setActivity(activity) {
    if (!this.ready) return;
    this.sock.write(encode(1, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: activity || undefined },
      nonce: `${Date.now()}-${Math.random()}`,
    }));
  }

  close() { try { this.sock?.destroy(); } catch {} this.sock = null; this.ready = false; }
}

// ---- State ----
function readSessions() {
  const now = Date.now();
  let files = [];
  try { files = fs.readdirSync(SESSIONS).filter((f) => f.endsWith('.json')); } catch {}
  const out = [];
  for (const f of files) {
    const p = path.join(SESSIONS, f);
    try {
      const s = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (now - s.updatedAt > STALE_MS) { fs.rmSync(p, { force: true }); continue; }
      out.push(s);
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

const clip = (s) => (s.length > 128 ? s.slice(0, 127) + '…' : s.length < 2 ? s + '  ' : s);
const ICONS = { think: 'thinking', edit: 'editing', read: 'reading', bash: 'terminal', search: 'searching', web: 'web', agent: 'agents', tool: 'tool', idle: 'idle' };

function buildActivity(sessions, cfg) {
  const s = sessions[0];
  const a = s.activity || { verb: 'idle', text: 'Idle' };
  let doing = a.text;
  if (!cfg.showFiles && a.file) doing = a.verb === 'edit' ? 'Editing code' : 'Reading code';
  const activity = {
    details: clip(doing),             // e.g. "Thinking…"
    state: clip(s.model || 'Claude'), // e.g. "Opus 5.5"
    timestamps: { start: Math.floor(s.startedAt / 1000) },
    instance: false,
  };
  const assets = {};
  if (cfg.largeImage) { assets.large_image = cfg.largeImage; assets.large_text = `${cfg.largeText || 'Claude Code'}${s.model ? ' · ' + s.model : ''}`; }
  if (cfg.smallImages) { assets.small_image = ICONS[a.verb] || 'tool'; assets.small_text = doing; }
  if (Object.keys(assets).length) activity.assets = assets;
  return activity;
}

// ---- Main loop ----
let rpc = null;
let lastJson = '';
let lastActiveAt = Date.now();
let connecting = false;
let lastError = '';

async function tick() {
  const cfg = loadConfig();
  if (!cfg.enabled) process.exit(0);

  const sessions = readSessions();
  if (sessions.length) lastActiveAt = Date.now();
  else if (Date.now() - lastActiveAt > EXIT_AFTER_IDLE_MS) { rpc?.setActivity(null); setTimeout(() => process.exit(0), 500); return; }

  if (!rpc?.ready) {
    if (connecting) return;
    connecting = true;
    rpc?.close();
    rpc = new RPC(cfg.clientId);
    try { await rpc.connect(); lastJson = ''; lastError = ''; }
    catch (e) { if (e.message !== lastError) log('connect failed:', e.message); lastError = e.message; }
    connecting = false;
    if (!rpc.ready) return;
  }

  const activity = sessions.length ? buildActivity(sessions, cfg) : null;
  const json = JSON.stringify(activity);
  if (json !== lastJson) { rpc.setActivity(activity); lastJson = json; }
}

log('daemon start pid', process.pid);
tick();
setInterval(tick, TICK_MS);
