// Builds the Discord activity payload (what your profile shows): picks which session to show,
// then turns it and the settings into the activity object.
const { textWithoutFile, iconFor } = require('./states');

/** Discord activity type numbers. The type is the word before "Claude Code". */
const ACTIVITY_TYPES = { playing: 0, listening: 2, watching: 3, competing: 5 };

const IDLE_ACTIVITY = { verb: 'idle', text: 'Idle' };

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
 * can't hide another that is busy. Ties go to the most recently updated.
 * @param {import('./sessions').Session[]} sessions
 * @returns {import('./sessions').Session | undefined}
 */
function selectSession(sessions) {
  const isWorking = (session) => (session.activity?.verb || 'idle') !== 'idle';
  const newestFirst = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return newestFirst.find(isWorking) || newestFirst[0];
}

/**
 * Discord activity for a session:
 *   details (line 1) = what Claude is doing, state (line 2) = model, plus elapsed time and images.
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
    timestamps: { start: Math.floor(session.startedAt / 1000) },
    instance: false,
  };

  const assets = {};
  if (config.largeImage) {
    assets.large_image = config.largeImage;
    assets.large_text = (config.largeText || 'Claude Code') + (session.model ? ' · ' + session.model : '');
  }
  if (config.smallImages) {
    assets.small_image = iconFor(current.verb);
    assets.small_text = statusText;
  }
  if (Object.keys(assets).length) activity.assets = assets;

  return activity;
}

module.exports = { ACTIVITY_TYPES, selectSession, buildActivity, fitDiscordText };
