// Minimal Discord IPC (local RPC) client. Zero dependencies.
//
// Discord listens on a unix socket (macOS/Linux) or named pipe (Windows) called discord-ipc-<0..9>.
// Each message is a frame: 8-byte header (int32 LE opcode, int32 LE payload length) + JSON payload.
const fs = require('fs');
const net = require('net');
const path = require('path');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const HEADER_SIZE = 8;
const HANDSHAKE_TIMEOUT_MS = 10000;

// Folders (under the runtime/temp dirs) where Discord, its flatpak/snap builds and Vesktop put the socket.
const SOCKET_SUBDIRS = [
  '',
  'app/com.discordapp.Discord',
  'app/com.discordapp.DiscordCanary',
  'app/dev.vencord.Vesktop',
  'snap.discord',
  'snap.discord-canary',
  '.flatpak/dev.vencord.Vesktop/xdg-run',
];

/**
 * Socket paths to try, in order. On unix only paths that exist are returned.
 * @returns {string[]}
 */
function socketCandidates() {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  }
  const env = process.env;
  const baseDirs = [env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].filter(Boolean);
  if (process.getuid) baseDirs.push(`/run/user/${process.getuid()}`);

  const found = [];
  for (const base of baseDirs) {
    for (const subdir of SOCKET_SUBDIRS) {
      for (let i = 0; i < 10; i++) {
        const candidate = path.join(base, subdir, `discord-ipc-${i}`);
        if (fs.existsSync(candidate)) found.push(candidate);
      }
    }
  }
  return [...new Set(found)];
}

/**
 * Encodes one IPC frame.
 * @param {number} op
 * @param {unknown} payload  JSON-serializable
 * @returns {Buffer}
 */
function encodeFrame(op, payload) {
  const json = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

/**
 * Splits a buffer into complete frames. Bytes of an incomplete trailing frame are returned as `rest`.
 * A payload that isn't valid JSON decodes as {}.
 * @param {Buffer} buffer
 * @returns {{ frames: { op: number, payload: any }[], rest: Buffer }}
 */
function decodeFrames(buffer) {
  const frames = [];
  let rest = buffer;
  while (rest.length >= HEADER_SIZE) {
    const op = rest.readInt32LE(0);
    const length = rest.readInt32LE(4);
    if (rest.length < HEADER_SIZE + length) break;
    let payload = {};
    try { payload = JSON.parse(rest.subarray(HEADER_SIZE, HEADER_SIZE + length).toString()); } catch {}
    frames.push({ op, payload });
    rest = rest.subarray(HEADER_SIZE + length);
  }
  return { frames, rest };
}

/**
 * Creates a client for one Discord application. Call connect(), then setActivity() as often as needed.
 * @param {string} clientId  Discord application ID
 * @param {(...parts: string[]) => void} [log]
 */
function createIpcClient(clientId, log = () => {}) {
  let socket = null;
  let ready = false;
  let pending = Buffer.alloc(0);

  function close() {
    try { socket?.destroy(); } catch {}
    socket = null;
    ready = false;
  }

  function handleFrame({ op, payload }, onReady, onFail) {
    if (op === OP.PING) {
      socket?.write(encodeFrame(OP.PONG, payload));
    } else if (op === OP.CLOSE) {
      log('discord closed:', JSON.stringify(payload));
      onFail(new Error(payload.message || 'closed'));
      close();
    } else if (payload.evt === 'READY') {
      ready = true;
      log('connected as', payload.data?.user?.username);
      onReady();
    } else if (payload.evt === 'ERROR') {
      log('rpc error:', JSON.stringify(payload.data));
    }
  }

  function handleData(chunk, onReady, onFail) {
    const { frames, rest } = decodeFrames(Buffer.concat([pending, chunk]));
    pending = rest;
    for (const frame of frames) handleFrame(frame, onReady, onFail);
  }

  // Sends the handshake on a freshly opened socket; resolves once Discord says READY.
  function handshake(openSocket, resolve, reject) {
    socket = openSocket;
    const timer = setTimeout(() => { reject(new Error('handshake timed out')); close(); }, HANDSHAKE_TIMEOUT_MS);
    const onReady = () => { clearTimeout(timer); resolve(); };
    const onFail = (error) => { clearTimeout(timer); reject(error); };

    openSocket.on('data', (chunk) => handleData(chunk, onReady, onFail));
    openSocket.on('error', (error) => { log('socket error', error.message); close(); });
    openSocket.on('close', () => { ready = false; socket = null; });
    openSocket.write(encodeFrame(OP.HANDSHAKE, { v: 1, client_id: clientId }));
  }

  /**
   * Connects to the first Discord socket that accepts, and completes the handshake.
   * @returns {Promise<void>}
   */
  function connect() {
    return new Promise((resolve, reject) => {
      const candidates = socketCandidates();
      if (!candidates.length) return reject(new Error('Discord IPC socket not found (is Discord running?)'));

      const tryCandidate = (index) => {
        if (index >= candidates.length) return reject(new Error('could not connect to any Discord IPC socket'));
        const attempt = net.createConnection(candidates[index]);
        attempt.once('error', () => tryCandidate(index + 1));
        attempt.once('connect', () => {
          attempt.removeAllListeners('error');
          handshake(attempt, resolve, reject);
        });
      };
      tryCandidate(0);
    });
  }

  /**
   * Shows `activity` on the user's profile, or clears it when null. Ignored until connected.
   * @param {object | null} activity
   */
  function setActivity(activity) {
    if (!ready) return;
    socket.write(encodeFrame(OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: activity || undefined },
      nonce: `${Date.now()}-${Math.random()}`,
    }));
  }

  return {
    connect,
    setActivity,
    close,
    /** True once the handshake completed and the socket is still open. */
    get ready() { return ready; },
  };
}

module.exports = { OP, socketCandidates, encodeFrame, decodeFrames, createIpcClient };
