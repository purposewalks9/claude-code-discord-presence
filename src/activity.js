// Builds the Discord activity payload (what your profile shows): picks which session to show,
// then turns it and the settings into the activity object.
const { textWithoutFile, iconFor } = require('./states');

/** Discord activity type numbers. The type is the word before "Claude Code". */
const ACTIVITY_TYPES = { playing: 0, listening: 2, watching: 3, competing: 5 };

const IDLE_ACTIVITY = { verb: 'idle', text: 'Idle' };

/** A "working" session silent this long behind the newest one is treated as stuck (e.g. crashed). */
const STUCK_AFTER_MS = 10 * 60 * 1000;

/**
 * Discord requires activity strings of 2 to 128 characters.
 * @param {string} text
 * @returns {string}
 */
function fitDiscordText(text) {
  if (text.length > 128) return text.slice(0, 127) + '…';
  if (text.length < 2) return text + '  ';
  return text;
}

/**
 * The session to show when several are live (all terminals, IDE and desktop sessions on this machine).
 * A working session (any state but idle) beats an idle one, so a session that just finished
 * can't hide another that is busy. Ties go to the most recently updated. A working session that
 * has gone quiet for STUCK_AFTER_MS while others kept updating (e.g. it crashed) no longer wins.
 * @param {import('./sessions').Session[]} sessions
 * @returns {import('./sessions').Session | undefined}
 */
function selectSession(sessions) {
  const newestFirst = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const newestUpdate = newestFirst[0]?.updatedAt ?? 0;
  const isWorking = (session) =>
    (session.activity?.verb || 'idle') !== 'idle' && newestUpdate - session.updatedAt < STUCK_AFTER_MS;
  return newestFirst.find(isWorking) || newestFirst[0];
}

/**
 * Discord activity for a session. The card shows only the app name (from the Discord app),
 * details (line 1) = what Claude is doing, and state (line 2) = the model. No elapsed timer.
 * @param {import('./sessions').Session} session
 * @param {import('./config').Config} config
 * @returns {object} the `activity` argument of Discord's SET_ACTIVITY command
 */
function buildActivity(session, config) {
  const current = session.activity || IDLE_ACTIVITY;
  const statusText = !config.showFiles && current.file ? textWithoutFile(current.verb) : current.text;

  const activity = {
    type: ACTIVITY_TYPES[config.activityType] ?? ACTIVITY_TYPES.playing,
    details: fitDiscordText(statusText),
    state: fitDiscordText(session.model || 'Claude'),
    instance: false,
  };

  const assets = {};
  if (config.largeImage) {
    assets.large_image = config.largeImage;
    assets.large_text = config.largeText || 'Claude Code';
  }
  if (config.smallImages) {
    assets.small_image = iconFor(current.verb);
    assets.small_text = statusText;
  }
  if (Object.keys(assets).length) activity.assets = assets;

  return activity;
}

module.exports = { ACTIVITY_TYPES, STUCK_AFTER_MS, selectSession, buildActivity, fitDiscordText };
