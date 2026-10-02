// Where the plugin keeps its state, and the user's settings (defaults merged with config.json).
// State lives outside the plugin folder so it survives plugin updates.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

const DATA_DIR = path.join(CLAUDE_DIR, 'discord-presence');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const PID_FILE = path.join(DATA_DIR, 'daemon.pid');
const LOG_FILE = path.join(DATA_DIR, 'daemon.log');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

/**
 * User settings, stored in config.json. Every key here can be changed with
 * `/discord-presence:presence set <key> <value>`.
 *
 * @typedef {object} Config
 * @property {boolean} enabled       Master switch.
 * @property {string}  clientId      Discord application ID.
 * @property {string}  activityType  playing | watching | listening | competing.
 * @property {boolean} showFiles     "Editing app.ts" (true) vs "Editing code" (false).
 * @property {string}  largeImage    Big image asset key on the Discord app.
 * @property {string}  largeText     Hover text of the big image.
 * @property {boolean} smallImages   Per-state corner icons (needs matching art assets on the Discord app).
 */

/** @type {Config} */
const DEFAULTS = {
  enabled: true,
  clientId: '1555585901264900199', // the shared "Claude Code" Discord app
  activityType: 'playing',
  showFiles: true,
  largeImage: 'claude',
  largeText: 'Claude Code',
  smallImages: false,
};

function readUserConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Settings in effect: defaults, then config.json, then the CLAUDE_DISCORD_CLIENT_ID env var.
 * @returns {Config}
 */
function loadConfig() {
  const config = { ...DEFAULTS, ...readUserConfig() };
  if (process.env.CLAUDE_DISCORD_CLIENT_ID) config.clientId = process.env.CLAUDE_DISCORD_CLIENT_ID;
  return config;
}

/**
 * Merges `patch` into config.json (only the user's own keys are written, not the defaults).
 * @param {Partial<Config>} patch
 */
function saveConfig(patch) {
  const merged = { ...readUserConfig(), ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n');
}

module.exports = {
  DATA_DIR,
  SESSIONS_DIR,
  PID_FILE,
  LOG_FILE,
  CONFIG_FILE,
  DEFAULTS,
  loadConfig,
  saveConfig,
};
