#!/usr/bin/env node
// Control CLI: status | restart | on | off | demo [seconds] | set <key> <value>
const fs = require('fs');
const path = require('path');
const { DATA, SESSIONS, LOG, CONFIG, DEFAULTS, loadConfig, saveConfig, daemonPid, startDaemon, stopDaemon } = require('../src/common');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const [cmd = 'status', ...args] = process.argv.slice(2);

function tailLog(n) {
  try { return fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(-n).join('\n'); } catch { return '(no log yet)'; }
}

function sessions() {
  try { return fs.readdirSync(SESSIONS).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(SESSIONS, f), 'utf8'))); } catch { return []; }
}

async function restart() {
  stopDaemon();
  await wait(800);
  startDaemon();
  await wait(2500);
}

const commands = {
  async status() {
    const cfg = loadConfig();
    const pid = daemonPid();
    console.log(`Enabled:  ${cfg.enabled}`);
    console.log(`Daemon:   ${pid ? `running (pid ${pid})` : 'not running (starts on next Claude Code event)'}`);
    console.log(`Sessions: ${sessions().map((s) => `${s.activity?.text || '?'} | ${s.model || '?'}`).join('; ') || 'none'}`);
    console.log(`Config:   ${CONFIG}`);
    console.log(`Settings: ${JSON.stringify(cfg)}`);
    console.log(`Log:\n${tailLog(5)}`);
  },
  async restart() { await restart(); console.log(`Restarted.\n${tailLog(2)}`); },
  async on() { saveConfig({ enabled: true }); startDaemon(); await wait(2500); console.log(`Presence on.\n${tailLog(1)}`); },
  async off() { saveConfig({ enabled: false }); stopDaemon(); console.log('Presence off. Your Discord status is cleared.'); },
  async demo() {
    const seconds = Number(args[0]) || 60;
    const states = [
      ['idle', 'Starting a session'], ['think', 'Thinking…'], ['read', 'Reading app.ts'], ['search', 'Searching the codebase'],
      ['edit', 'Editing app.ts'], ['bash', 'Running commands'], ['web', 'Browsing the web'], ['agent', 'Running subagents'],
      ['tool', 'Using Gmail'], ['idle', 'Waiting for input'],
    ];
    const models = ['Opus 5.5', 'Sonnet 5.5', 'Haiku 4.5', 'Fable 5.1'];
    const file = path.join(SESSIONS, 'demo.json');
    const cleanup = () => fs.rmSync(file, { force: true });
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    fs.mkdirSync(SESSIONS, { recursive: true });
    startDaemon();
    const startedAt = Date.now();
    for (let i = 0; Date.now() - startedAt < seconds * 1000; i++) {
      const [verb, text] = states[i % states.length];
      const model = models[Math.floor(i / states.length) % models.length];
      fs.writeFileSync(file, JSON.stringify({ sessionId: 'demo', startedAt, updatedAt: Date.now(), activity: { verb, text }, model }));
      console.log(`${text} | ${model}`);
      await wait(6000);
    }
    cleanup();
    console.log('Demo finished.');
  },
  async set() {
    const [key, value] = args;
    if (!(key in DEFAULTS)) { console.log(`Unknown setting "${key}". Options: ${Object.keys(DEFAULTS).join(', ')}`); process.exit(1); }
    const v = value === 'true' ? true : value === 'false' ? false : value;
    saveConfig({ [key]: v });
    await restart();
    console.log(`Set ${key} = ${JSON.stringify(v)} and restarted.`);
  },
};

(commands[cmd] || (async () => { console.log('Usage: presence status | restart | on | off | demo [seconds] | set <key> <value>'); }))();
