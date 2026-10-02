// Every status Claude can be in, in one place: what each hook event and each tool shows on
// Discord, and which corner icon goes with it. To add a state, add one line to a table below.
const path = require('path');

/**
 * What Claude is doing right now. Stored in the session file and shown as line 1 on Discord.
 *
 * @typedef {object} Activity
 * @property {string} verb             State key (think, edit, read, bash, search, web, agent, tool, idle).
 * @property {string} text             Status text, e.g. "Editing app.ts".
 * @property {string | null} [file]    File name, only for states that show one.
 */

/** Status set by each hook event. PreToolUse is handled by TOOL_STATES; SessionEnd deletes the session. */
const EVENT_STATES = {
  SessionStart:     { verb: 'idle',  text: 'Starting a session' },
  UserPromptSubmit: { verb: 'think', text: 'Thinking…' },
  PostToolUse:      { verb: 'think', text: 'Thinking…' },
  Stop:             { verb: 'idle',  text: 'Waiting for input' },
  Notification:     { verb: 'idle',  text: 'Waiting for input' },
};

/**
 * Status shown while a tool runs. `fileText` is used when the tool input names a file
 * ({file} is replaced by its base name); `text` is used otherwise, or when showFiles is off.
 * Tools not listed here show "Using <tool>".
 */
const TOOL_STATES = [
  { tools: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit'], verb: 'edit',   text: 'Editing code', fileText: 'Editing {file}' },
  { tools: ['Read'],                                       verb: 'read',   text: 'Reading code', fileText: 'Reading {file}' },
  { tools: ['Bash', 'PowerShell'],                         verb: 'bash',   text: 'Running commands' },
  { tools: ['Grep', 'Glob'],                               verb: 'search', text: 'Searching the codebase' },
  { tools: ['WebFetch', 'WebSearch'],                      verb: 'web',    text: 'Browsing the web' },
  { tools: ['Agent', 'Task'],                              verb: 'agent',  text: 'Running subagents' },
];

/** Small corner image asset key for each verb (used when smallImages is on). */
const STATE_ICONS = {
  think: 'thinking',
  edit: 'editing',
  read: 'reading',
  bash: 'terminal',
  search: 'searching',
  web: 'web',
  agent: 'agents',
  tool: 'tool',
  idle: 'idle',
};
const DEFAULT_ICON = 'tool';

/**
 * Activity for a hook event, or undefined if the event doesn't change it.
 * @param {string} eventName
 * @returns {Activity | undefined}
 */
function describeEvent(eventName) {
  const state = EVENT_STATES[eventName];
  return state && { ...state };
}

/**
 * Activity for a tool call, e.g. ("Edit", {file_path: "/x/app.ts"}) -> "Editing app.ts".
 * @param {string} toolName
 * @param {object} [toolInput]
 * @returns {Activity}
 */
function describeTool(toolName, toolInput = {}) {
  const state = TOOL_STATES.find((s) => s.tools.includes(toolName));
  if (!state) return { verb: 'tool', text: `Using ${shortToolName(toolName)}` };
  if (!state.fileText) return { verb: state.verb, text: state.text };

  const filePath = toolInput.file_path || toolInput.notebook_path || toolInput.path;
  const file = filePath ? path.basename(filePath) : null;
  return { verb: state.verb, text: file ? state.fileText.replace('{file}', file) : state.text, file };
}

/** "mcp__claude_ai_Gmail__send" -> "send", "Skill" -> "Skill". */
function shortToolName(toolName) {
  return toolName.replace(/^mcp__/, '').split('__').pop();
}

/**
 * Status text without the file name ("Editing code"), for when showFiles is off.
 * @param {string} verb
 * @returns {string}
 */
function textWithoutFile(verb) {
  const state = TOOL_STATES.find((s) => s.verb === verb && s.fileText) || TOOL_STATES.find((s) => s.verb === 'read');
  return state.text;
}

/**
 * Corner icon asset key for a verb.
 * @param {string} verb
 * @returns {string}
 */
function iconFor(verb) {
  return STATE_ICONS[verb] || DEFAULT_ICON;
}

module.exports = { EVENT_STATES, TOOL_STATES, STATE_ICONS, describeEvent, describeTool, textWithoutFile, iconFor };
