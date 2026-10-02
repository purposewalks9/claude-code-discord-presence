const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatModelName, readModelFromTranscript } = require('../src/models');

test('formatModelName turns model ids into display names', () => {
  assert.strictEqual(formatModelName('claude-opus-5-5'), 'Opus 5.5');
  assert.strictEqual(formatModelName('claude-sonnet-5-5[1m]'), 'Sonnet 5.5');
  assert.strictEqual(formatModelName('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.strictEqual(formatModelName('claude-3-5-sonnet-20241022'), 'Sonnet 3.5');
  assert.strictEqual(formatModelName('claude-fable-5-1'), 'Fable 5.1');
});

test('formatModelName returns null for non-models and empty input', () => {
  assert.strictEqual(formatModelName('<synthetic>'), null);
  assert.strictEqual(formatModelName(''), null);
  assert.strictEqual(formatModelName(undefined), null);
  assert.strictEqual(formatModelName({ id: 'claude-opus-5-5' }), null);
});

test('formatModelName keeps ids without a family name unchanged', () => {
  assert.strictEqual(formatModelName('12-34'), '12-34');
});

test('readModelFromTranscript returns the last model in the transcript', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-test-'));
  try {
    const transcript = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(transcript, [
      '{"message":{"model":"claude-sonnet-5-5"}}',
      '{"message":{"model":"<synthetic>"}}',
      '{"message":{"model":"claude-opus-5-5"}}',
    ].join('\n'));

    assert.strictEqual(readModelFromTranscript(transcript), 'claude-opus-5-5');
    assert.strictEqual(readModelFromTranscript(path.join(dir, 'missing.jsonl')), null);
    assert.strictEqual(readModelFromTranscript(undefined), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
