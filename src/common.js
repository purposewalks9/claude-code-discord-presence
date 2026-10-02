// Shared paths, config and daemon helpers.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// State lives outside the plugin folder so it survives plugin updates.
const DATA = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'discord-presence');
const SESSIONS = path.join(DATA, 'sessions');
const PIDFILE = path.join(DATA, 'daemon.pid');
const LOG = path.join(DATA, 'daemon.log');
const CONFIG = path.join(DATA, 'config.json');

const DEFAULTS = {
  enabled: true,
  clientId: '1555585901264900199', // the shared "Claude Code" Discord app
  activityType: 'playing',         // playing | watching | listening | competing
  showFiles: true,                 // "Editing app.ts" vs "Editing code"
  largeImage: 'claude',
  largeText: 'Claude Code',
  smallImages: false,              // per-state icons; needs matching art assets on the Discord app
};

function loadConfig() {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch {}
  const c = { ...DEFAULTS, ...user };
  if (process.env.CLAUDE_DISCORD_CLIENT_ID) c.clientId = process.env.CLAUDE_DISCORD_CLIENT_ID;
  return c;
}

function saveConfig(patch) {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch {}
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify({ ...user, ...patch }, null, 2) + '\n');
}

function daemonPid() {
  try {
    const pid = parseInt(fs.readFileSync(PIDFILE, 'utf8'), 10);
    process.kill(pid, 0);
    return pid;
  } catch { return null; }
}

function startDaemon() {
  if (daemonPid()) return;
  fs.mkdirSync(DATA, { recursive: true });
  spawn(process.execPath, [path.join(ROOT, 'src', 'daemon.js')], {
    detached: true, stdio: 'ignore', cwd: DATA, windowsHide: true,
  }).unref();
}

function stopDaemon() {
  const pid = daemonPid();
  if (pid) try { process.kill(pid, 'SIGTERM'); } catch {}
  try { fs.rmSync(PIDFILE, { force: true }); } catch {}
  return pid;
}

module.exports = { ROOT, DATA, SESSIONS, PIDFILE, LOG, CONFIG, DEFAULTS, loadConfig, saveConfig, daemonPid, startDaemon, stopDaemon };
