const test = require('node:test');
const assert = require('node:assert');
const { buildActivity, selectSession, fitDiscordText } = require('../src/activity');

const config = {
  enabled: true,
  clientId: '1',
  activityType: 'playing',
  showFiles: true,
  largeImage: 'claude',
  largeText: 'Claude Code',
  smallImages: false,
};

const session = {
  sessionId: 's1',
  startedAt: 1_700_000_000_500,
  updatedAt: 1_700_000_100_000,
  model: 'Opus 5.5',
  activity: { verb: 'edit', text: 'Editing app.ts', file: 'app.ts' },
};

test('builds the default activity', () => {
  assert.deepStrictEqual(buildActivity(session, config), {
    type: 0,
    details: 'Editing app.ts',
    state: 'Opus 5.5',
    instance: false,
    assets: { large_image: 'claude', large_text: 'Claude Code' },
  });
});

test('the card shows no elapsed timer and the hover text is just largeText', () => {
  const activity = buildActivity(session, { ...config, largeText: 'My Claude' });
  assert.strictEqual(activity.timestamps, undefined);
  assert.strictEqual(activity.assets.large_text, 'My Claude');
});

test('showFiles false hides the file name', () => {
  const activity = buildActivity(session, { ...config, showFiles: false });
  assert.strictEqual(activity.details, 'Editing code');

  const reading = { ...session, activity: { verb: 'read', text: 'Reading a.md', file: 'a.md' } };
  assert.strictEqual(buildActivity(reading, { ...config, showFiles: false }).details, 'Reading code');

  const bash = { ...session, activity: { verb: 'bash', text: 'Running commands' } };
  assert.strictEqual(buildActivity(bash, { ...config, showFiles: false }).details, 'Running commands');
});

test('activityType picks the Discord activity type', () => {
  assert.strictEqual(buildActivity(session, { ...config, activityType: 'playing' }).type, 0);
  assert.strictEqual(buildActivity(session, { ...config, activityType: 'listening' }).type, 2);
  assert.strictEqual(buildActivity(session, { ...config, activityType: 'watching' }).type, 3);
  assert.strictEqual(buildActivity(session, { ...config, activityType: 'competing' }).type, 5);
  assert.strictEqual(buildActivity(session, { ...config, activityType: 'bogus' }).type, 0);
});

test('smallImages adds a per-state corner icon', () => {
  const activity = buildActivity(session, { ...config, smallImages: true });
  assert.strictEqual(activity.assets.small_image, 'editing');
  assert.strictEqual(activity.assets.small_text, 'Editing app.ts');
  assert.strictEqual(buildActivity(session, config).assets.small_image, undefined);
});

test('no large image and no small images means no assets', () => {
  assert.strictEqual(buildActivity(session, { ...config, largeImage: '' }).assets, undefined);
});

test('missing model and activity fall back to defaults', () => {
  const bare = { sessionId: 's', startedAt: 0, updatedAt: 0, model: null };
  const activity = buildActivity(bare, config);
  assert.strictEqual(activity.details, 'Idle');
  assert.strictEqual(activity.state, 'Claude');
  assert.strictEqual(activity.assets.large_text, 'Claude Code');
});

test('fitDiscordText keeps text within 2..128 characters', () => {
  assert.strictEqual(fitDiscordText('x'), 'x  ');
  assert.strictEqual(fitDiscordText('ok'), 'ok');
  const long = fitDiscordText('a'.repeat(200));
  assert.strictEqual(long.length, 128);
  assert.ok(long.endsWith('…'));
});

const make = (id, verb, updatedAt) => ({ sessionId: id, startedAt: 0, updatedAt, model: null, activity: { verb, text: verb } });

test('selectSession prefers a working session over a newer idle one', () => {
  const sessions = [make('idle-new', 'idle', 300), make('busy-old', 'bash', 100), make('busy-mid', 'think', 200)];
  assert.strictEqual(selectSession(sessions).sessionId, 'busy-mid');
});

test('selectSession picks the newest session when all are idle', () => {
  const sessions = [make('a', 'idle', 100), make('b', 'idle', 300), make('c', 'idle', 200)];
  assert.strictEqual(selectSession(sessions).sessionId, 'b');
});

test('selectSession treats a session without activity as idle', () => {
  const noActivity = { sessionId: 'x', startedAt: 0, updatedAt: 500, model: null };
  assert.strictEqual(selectSession([noActivity, make('busy', 'edit', 100)]).sessionId, 'busy');
  assert.strictEqual(selectSession([noActivity]).sessionId, 'x');
  assert.strictEqual(selectSession([]), undefined);
});
