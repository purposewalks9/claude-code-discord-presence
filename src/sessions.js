// Per-session state files in <data dir>/sessions/<session id>.json. Hooks write them, the daemon reads them.
const fs = require('fs');
const path = require('path');
const { SESSIONS_DIR } = require('./config');

const STALE_MS = 30 * 60 * 1000; // a session with no events for 30 min is ignored (and its file removed)

/**
 * One Claude Code session, as stored on disk.
 *
 * @typedef {object} Session
 * @property {string} sessionId
 * @property {number} startedAt                         ms since epoch, first event seen.
 * @property {number} updatedAt                         ms since epoch, latest event seen.
 * @property {string | null} model                      Display name, e.g. "Opus 5.5".
 * @property {import('./states').Activity} [activity]   What Claude is doing.
 */

/**
 * Session id made safe to use as a file name.
 * @param {unknown} rawId
 * @returns {string}
 */
function sanitizeSessionId(rawId) {
  return String(rawId || 'unknown').replace(/[^\w-]/g, '');
}

function sessionFile(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

/**
 * @param {string} sessionId
 * @returns {Partial<Session>} the stored session, or {} if there is none
 */
function readSession(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(sessionId), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * @param {string} sessionId
 * @param {Session} session
 */
function writeSession(sessionId, session) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(sessionFile(sessionId), JSON.stringify(session));
}

/** @param {string} sessionId */
function removeSession(sessionId) {
  fs.rmSync(sessionFile(sessionId), { force: true });
}

/**
 * All readable sessions, in directory order.
 * @returns {{ file: string, session: Session }[]}
 */
function readAllSessions() {
  let names = [];
  try {
    names = fs.readdirSync(SESSIONS_DIR).filter((name) => name.endsWith('.json'));
  } catch {}

  const entries = [];
  for (const name of names) {
    const file = path.join(SESSIONS_DIR, name);
    try {
      entries.push({ file, session: JSON.parse(fs.readFileSync(file, 'utf8')) });
    } catch {}
  }
  return entries;
}

/**
 * Sessions updated in the last 30 minutes, most recent first. Deletes the files of stale ones.
 * @param {number} [now]
 * @returns {Session[]}
 */
function readActiveSessions(now = Date.now()) {
  const active = [];
  for (const { file, session } of readAllSessions()) {
    if (now - session.updatedAt > STALE_MS) {
      try { fs.rmSync(file, { force: true }); } catch {}
    } else {
      active.push(session);
    }
  }
  return active.sort((a, b) => b.updatedAt - a.updatedAt);
}

module.exports = {
  STALE_MS,
  sanitizeSessionId,
  readSession,
  writeSession,
  removeSession,
  readAllSessions,
  readActiveSessions,
};
