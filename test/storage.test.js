// Config and session files, in a temp CLAUDE_CONFIG_DIR so nothing touches the real ~/.claude.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-test-'));
process.env.CLAUDE_CONFIG_DIR = tempDir;
delete process.env.CLAUDE_DISCORD_CLIENT_ID;

const { test, after } = require('node:test');
const assert = require('node:assert');
const config = require('../src/config');
const sessions = require('../src/sessions');

after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test('paths live under CLAUDE_CONFIG_DIR/discord-presence', () => {
  const dataDir = path.join(tempDir, 'discord-presence');
  assert.strictEqual(config.DATA_DIR, dataDir);
  assert.strictEqual(config.SESSIONS_DIR, path.join(dataDir, 'sessions'));
  assert.strictEqual(config.CONFIG_FILE, path.join(dataDir, 'config.json'));
  assert.strictEqual(config.PID_FILE, path.join(dataDir, 'daemon.pid'));
  assert.strictEqual(config.LOG_FILE, path.join(dataDir, 'daemon.log'));
});

test('loadConfig merges defaults, config.json and the client id env var', () => {
  assert.deepStrictEqual(config.loadConfig(), config.DEFAULTS);

  config.saveConfig({ showFiles: false });
  config.saveConfig({ activityType: 'watching' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf8')), { showFiles: false, activityType: 'watching' });
  assert.deepStrictEqual(config.loadConfig(), { ...config.DEFAULTS, showFiles: false, activityType: 'watching' });

  process.env.CLAUDE_DISCORD_CLIENT_ID = '42';
  try {
    assert.strictEqual(config.loadConfig().clientId, '42');
  } finally {
    delete process.env.CLAUDE_DISCORD_CLIENT_ID;
  }
});

test('sanitizeSessionId keeps only safe file name characters', () => {
  assert.strictEqual(sessions.sanitizeSessionId('ab-12_c'), 'ab-12_c');
  assert.strictEqual(sessions.sanitizeSessionId('../../etc/passwd'), 'etcpasswd');
  assert.strictEqual(sessions.sanitizeSessionId(undefined), 'unknown');
});

test('session files round-trip; stale ones are removed; newest first', () => {
  const now = Date.now();
  const make = (id, updatedAt) => ({ sessionId: id, startedAt: updatedAt, updatedAt, model: null });
  sessions.writeSession('old', make('old', now - 10_000));
  sessions.writeSession('new', make('new', now - 1_000));
  sessions.writeSession('stale', make('stale', now - sessions.STALE_MS - 1));

  assert.deepStrictEqual(sessions.readSession('new'), make('new', now - 1_000));
  assert.deepStrictEqual(sessions.readSession('missing'), {});

  assert.deepStrictEqual(sessions.readActiveSessions(now).map((s) => s.sessionId), ['new', 'old']);
  assert.ok(!fs.existsSync(path.join(config.SESSIONS_DIR, 'stale.json')));

  sessions.removeSession('old');
  assert.deepStrictEqual(sessions.readAllSessions().map((e) => e.session.sessionId), ['new']);
});
