// Uses a temp CLAUDE_CONFIG_DIR so nothing touches the real ~/.claude.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-test-'));
process.env.CLAUDE_CONFIG_DIR = tempDir;

const { test, after } = require('node:test');
const assert = require('node:assert');
const { applyHookEvent } = require('../src/hook');

after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const context = { sessionId: 't', now: 1000, transcriptModel: null };

test('a new session gets ids, timestamps and the tool status', () => {
  const session = applyHookEvent({}, {
    session_id: 't', hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '/x/app.ts' },
  }, context);
  assert.deepStrictEqual(session, {
    sessionId: 't', startedAt: 1000, updatedAt: 1000, model: null,
    activity: { verb: 'edit', text: 'Editing app.ts', file: 'app.ts' },
  });
});

test('later events keep startedAt and the previous model', () => {
  const previous = { sessionId: 't', startedAt: 500, updatedAt: 600, model: 'Opus 5.5', activity: { verb: 'idle', text: 'x' } };
  const session = applyHookEvent(previous, { hook_event_name: 'UserPromptSubmit' }, context);
  assert.strictEqual(session.startedAt, 500);
  assert.strictEqual(session.updatedAt, 1000);
  assert.strictEqual(session.model, 'Opus 5.5');
  assert.deepStrictEqual(session.activity, { verb: 'think', text: 'Thinking…' });
});

test('model comes from the transcript first, then the event', () => {
  const fromTranscript = applyHookEvent({}, { model: 'claude-haiku-4-5' }, { ...context, transcriptModel: 'claude-opus-5-5' });
  assert.strictEqual(fromTranscript.model, 'Opus 5.5');
  assert.strictEqual(applyHookEvent({}, { model: { id: 'claude-sonnet-5-5[1m]' } }, context).model, 'Sonnet 5.5');
  assert.strictEqual(applyHookEvent({}, { model: 'claude-haiku-4-5-20251001' }, context).model, 'Haiku 4.5');
});

test('unknown events keep the activity', () => {
  const previous = { activity: { verb: 'bash', text: 'Running commands' } };
  assert.deepStrictEqual(applyHookEvent(previous, { hook_event_name: 'PreCompact' }, context).activity, previous.activity);
});

test('subagent fields (agent_id, agent_type) update the parent session normally', () => {
  const session = applyHookEvent({}, {
    session_id: 't', agent_id: 'a1', agent_type: 'Explore',
    hook_event_name: 'PreToolUse', tool_name: 'Grep', tool_input: { pattern: 'x' },
  }, context);
  assert.strictEqual(session.sessionId, 't');
  assert.deepStrictEqual(session.activity, { verb: 'search', text: 'Searching the codebase' });
});
