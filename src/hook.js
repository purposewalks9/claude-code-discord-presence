// Claude Code hook entry point (run by scripts/run.sh for every hook event).
// Reads the hook event JSON from stdin, updates that session's state file,
// and starts the daemon if it isn't running. It never fails loudly: presence
// must not get in the way of Claude Code.
const { loadConfig } = require('./config');
const { startDaemon } = require('./daemon-control');
const { sanitizeSessionId, readSession, writeSession, removeSession } = require('./sessions');
const { describeEvent, describeTool } = require('./states');
const { formatModelName, readModelFromTranscript } = require('./models');

/**
 * Applies one hook event to a session's stored state (mutates and returns `session`).
 * Events that don't map to a status (unknown ones) only refresh the timestamps and model.
 * Subagent tool calls carry the parent's session_id (plus agent_id/agent_type, which are
 * ignored), so they update the parent session.
 * @param {Partial<import('./sessions').Session>} session  previous state, {} for a new session
 * @param {object} event          hook input (hook_event_name, tool_name, tool_input, model, …)
 * @param {object} context
 * @param {string} context.sessionId
 * @param {number} context.now
 * @param {string | null} context.transcriptModel  model id found in the transcript
 * @returns {import('./sessions').Session}
 */
function applyHookEvent(session, event, { sessionId, now, transcriptModel }) {
  session.sessionId = sessionId;
  session.startedAt = session.startedAt || now;
  session.updatedAt = now;

  const eventModel = typeof event.model === 'string' ? event.model : event.model?.id;
  session.model = formatModelName(transcriptModel) || formatModelName(eventModel) || session.model || null;

  const activity = event.hook_event_name === 'PreToolUse'
    ? describeTool(event.tool_name || 'tool', event.tool_input)
    : describeEvent(event.hook_event_name);
  if (activity) session.activity = activity;

  return session;
}

function handleHookInput(rawInput) {
  if (!loadConfig().enabled) return;
  const event = JSON.parse(rawInput || '{}');
  const sessionId = sanitizeSessionId(event.session_id);

  if (event.hook_event_name === 'SessionEnd') {
    removeSession(sessionId);
    return;
  }

  const session = applyHookEvent(readSession(sessionId), event, {
    sessionId,
    now: Date.now(),
    transcriptModel: readModelFromTranscript(event.transcript_path),
  });
  writeSession(sessionId, session);
  startDaemon();
}

if (require.main === module) {
  let rawInput = '';
  process.stdin.on('data', (chunk) => (rawInput += chunk));
  process.stdin.on('end', () => {
    try {
      handleHookInput(rawInput);
    } catch {
      // never break Claude Code over presence
    }
  });
}

module.exports = { applyHookEvent };
