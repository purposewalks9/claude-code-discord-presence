// Background process that keeps Discord in sync with Claude Code.
// Every few seconds it reads the session files, shows the most recently active session,
// and reconnects to Discord when needed. It exits after 5 minutes with no sessions;
// the next hook event starts it again.
const fs = require('fs');
const { DATA_DIR, PID_FILE, LOG_FILE, loadConfig } = require('./config');
const { readDaemonPid } = require('./daemon-control');
const { readActiveSessions } = require('./sessions');
const { buildActivity } = require('./activity');
const { createIpcClient } = require('./discord/ipc');

const TICK_MS = 3000;
const EXIT_AFTER_IDLE_MS = 5 * 60 * 1000;
const MAX_LOG_BYTES = 256 * 1024;

function log(...parts) {
  try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${parts.join(' ')}\n`); } catch {}
}

function resetLogIfLarge() {
  try { if (fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) fs.rmSync(LOG_FILE); } catch {}
}

// Exits if another daemon is running; otherwise records our PID and removes it on exit.
function claimSingleInstance() {
  const otherPid = readDaemonPid();
  if (otherPid && otherPid !== process.pid) process.exit(0);
  fs.writeFileSync(PID_FILE, String(process.pid));
  process.on('exit', () => {
    try { if (fs.readFileSync(PID_FILE, 'utf8') == process.pid) fs.rmSync(PID_FILE); } catch {}
  });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(0));
}

let discord = null;
let connecting = false;
let lastSentJson = '';
let lastConnectError = '';
let lastActiveAt = Date.now();

// Makes sure we have a ready Discord connection. Returns false if we don't (yet).
async function ensureConnected(clientId) {
  if (discord?.ready) return true;
  if (connecting) return false;
  connecting = true;
  discord?.close();
  discord = createIpcClient(clientId, log);
  try {
    await discord.connect();
    lastSentJson = ''; // new connection: resend the activity
    lastConnectError = '';
  } catch (error) {
    if (error.message !== lastConnectError) log('connect failed:', error.message);
    lastConnectError = error.message;
  }
  connecting = false;
  return discord.ready;
}

async function tick() {
  const config = loadConfig();
  if (!config.enabled) process.exit(0);

  const sessions = readActiveSessions();
  if (sessions.length) {
    lastActiveAt = Date.now();
  } else if (Date.now() - lastActiveAt > EXIT_AFTER_IDLE_MS) {
    discord?.setActivity(null);
    setTimeout(() => process.exit(0), 500);
    return;
  }

  if (!(await ensureConnected(config.clientId))) return;

  const activity = sessions.length ? buildActivity(sessions[0], config) : null;
  const json = JSON.stringify(activity);
  if (json !== lastSentJson) {
    discord.setActivity(activity);
    lastSentJson = json;
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
resetLogIfLarge();
claimSingleInstance();
log('daemon start pid', process.pid);
tick();
setInterval(tick, TICK_MS);
