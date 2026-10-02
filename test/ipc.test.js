const test = require('node:test');
const assert = require('node:assert');
const { OP, encodeFrame, decodeFrames } = require('../src/discord/ipc');

test('encodeFrame writes an 8-byte little-endian header and JSON payload', () => {
  const frame = encodeFrame(OP.HANDSHAKE, { v: 1, client_id: '123' });
  const json = JSON.stringify({ v: 1, client_id: '123' });
  assert.strictEqual(frame.readInt32LE(0), 0);
  assert.strictEqual(frame.readInt32LE(4), Buffer.byteLength(json));
  assert.strictEqual(frame.subarray(8).toString(), json);
});

test('encodeFrame uses byte length for multi-byte characters', () => {
  const frame = encodeFrame(OP.FRAME, { text: 'Thinking…' });
  assert.strictEqual(frame.readInt32LE(4), frame.length - 8);
  assert.deepStrictEqual(decodeFrames(frame).frames[0].payload, { text: 'Thinking…' });
});

test('decodeFrames round-trips several frames', () => {
  const buffer = Buffer.concat([encodeFrame(OP.PING, { a: 1 }), encodeFrame(OP.FRAME, { evt: 'READY' })]);
  const { frames, rest } = decodeFrames(buffer);
  assert.deepStrictEqual(frames, [{ op: 3, payload: { a: 1 } }, { op: 1, payload: { evt: 'READY' } }]);
  assert.strictEqual(rest.length, 0);
});

test('decodeFrames keeps an incomplete frame for later', () => {
  const full = encodeFrame(OP.FRAME, { evt: 'READY', data: { user: { username: 'me' } } });
  const first = decodeFrames(full.subarray(0, 5));
  assert.deepStrictEqual(first.frames, []);
  assert.strictEqual(first.rest.length, 5);

  const second = decodeFrames(Buffer.concat([first.rest, full.subarray(5, 20)]));
  assert.deepStrictEqual(second.frames, []);

  const third = decodeFrames(Buffer.concat([second.rest, full.subarray(20)]));
  assert.strictEqual(third.frames.length, 1);
  assert.strictEqual(third.frames[0].payload.data.user.username, 'me');
  assert.strictEqual(third.rest.length, 0);
});

test('decodeFrames decodes invalid JSON as an empty object', () => {
  const body = Buffer.from('not json');
  const header = Buffer.alloc(8);
  header.writeInt32LE(OP.CLOSE, 0);
  header.writeInt32LE(body.length, 4);
  assert.deepStrictEqual(decodeFrames(Buffer.concat([header, body])).frames, [{ op: 2, payload: {} }]);
});

test('opcodes match the Discord IPC protocol', () => {
  assert.deepStrictEqual(OP, { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 });
});
