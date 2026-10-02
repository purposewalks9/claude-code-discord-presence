#!/usr/bin/env node
// Control CLI behind the /discord-presence:presence slash command.
// Usage: presence status | restart | on | off | demo [seconds] | set <key> <value>
const fs = require('fs');
const { LOG_FILE, CONFIG_FILE, DEFAULTS, loadConfig, saveConfig } = require('../src/config');
const { readDaemonPid, startDaemon, stopDaemon } = require('../src/daemon-control');
const { readAllSessions, writeSession, removeSession } = require('../src/sessions');

const USAGE = 'Usage: presence status | restart | on | off | demo [seconds] | set <key> <value>';

// States and models the demo cycles through.
const DEMO_STATES = [
  ['idle', 'Starting a session'],
  ['think', 'Thinking…'],
  ['read', 'Reading app.ts'],
  ['search', 'Searching the codebase'],
  ['edit', 'Editing app.ts'],
  ['bash', 'Running commands'],
  ['web', 'Browsing the web'],
  ['agent', 'Running subagents'],
  ['tool', 'Using Gmail'],
  ['idle', 'Waiting for input'],
];
const DEMO_MODELS = ['Opus 5.5', 'Sonnet 5.5', 'Haiku 4.5', 'Fable 5.1'];
const DEMO_STEP_MS = 6000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tailLog(lineCount) {
  try {
    return fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-lineCount).join('\n');
  } catch {
    return '(no log yet)';
  }
}

async function restartDaemon() {
  stopDaemon();
  await wait(800);
  startDaemon();
  await wait(2500); // give it time to connect, so the log shows the result
}

// "true"/"false" become booleans, anything else stays a string.
function parseSettingValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

const commands = {
  async status() {
    const config = loadConfig();
    const pid = readDaemonPid();
    const sessions = readAllSessions()
      .map(({ session }) => `${session.activity?.text || '?'} | ${session.model || '?'}`)
      .join('; ');
    console.log(`Enabled:  ${config.enabled}`);
    console.log(`Daemon:   ${pid ? `running (pid ${pid})` : 'not running (starts on next Claude Code event)'}`);
    console.log(`Sessions: ${sessions || 'none'}`);
    console.log(`Config:   ${CONFIG_FILE}`);
    console.log(`Settings: ${JSON.stringify(config)}`);
    console.log(`Log:\n${tailLog(5)}`);
  },

  async restart() {
    await restartDaemon();
    console.log(`Restarted.\n${tailLog(2)}`);
  },

  async on() {
    saveConfig({ enabled: true });
    startDaemon();
    await wait(2500);
    console.log(`Presence on.\n${tailLog(1)}`);
  },

  async off() {
    saveConfig({ enabled: false });
    stopDaemon();
    console.log('Presence off. Your Discord status is cleared.');
  },

  // Writes a fake "demo" session that cycles through every state.
  async demo(seconds) {
    const durationMs = (Number(seconds) || 60) * 1000;
    const cleanup = () => removeSession('demo');
    process.on('SIGINT', () => { cleanup(); process.exit(0); });

    startDaemon();
    const startedAt = Date.now();
    for (let step = 0; Date.now() - startedAt < durationMs; step++) {
      const [verb, text] = DEMO_STATES[step % DEMO_STATES.length];
      const model = DEMO_MODELS[Math.floor(step / DEMO_STATES.length) % DEMO_MODELS.length];
      writeSession('demo', { sessionId: 'demo', startedAt, updatedAt: Date.now(), activity: { verb, text }, model });
      console.log(`${text} | ${model}`);
      await wait(DEMO_STEP_MS);
    }
    cleanup();
    console.log('Demo finished.');
  },

  async set(key, value) {
    if (!(key in DEFAULTS)) {
      console.log(`Unknown setting "${key}". Options: ${Object.keys(DEFAULTS).join(', ')}`);
      process.exit(1);
    }
    const parsed = parseSettingValue(value);
    saveConfig({ [key]: parsed });
    await restartDaemon();
    console.log(`Set ${key} = ${JSON.stringify(parsed)} and restarted.`);
  },
};

const [commandName = 'status', ...args] = process.argv.slice(2);
const command = commands[commandName] || (async () => console.log(USAGE));
command(...args);
