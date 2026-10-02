// Claude Code hook: records per-session activity and makes sure the presence daemon is running.
const fs = require('fs');
const path = require('path');
const { SESSIONS, loadConfig, startDaemon } = require('./common');

function describeTool(name, input = {}) {
  const file = input.file_path || input.notebook_path || input.path;
  const base = file ? path.basename(file) : null;
  switch (name) {
    case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
      return { verb: 'edit', text: base ? `Editing ${base}` : 'Editing code', file: base };
    case 'Read':
      return { verb: 'read', text: base ? `Reading ${base}` : 'Reading code', file: base };
    case 'Bash': case 'PowerShell': return { verb: 'bash', text: 'Running commands' };
    case 'Grep': case 'Glob': return { verb: 'search', text: 'Searching the codebase' };
    case 'WebFetch': case 'WebSearch': return { verb: 'web', text: 'Browsing the web' };
    case 'Agent': case 'Task': return { verb: 'agent', text: 'Running subagents' };
    default: return { verb: 'tool', text: `Using ${name.replace(/^mcp__/, '').split('__').pop()}` };
  }
}

// "claude-opus-5-5[1m]" -> "Opus 5.5", "claude-haiku-4-5-20251001" -> "Haiku 4.5"
function prettyModel(id) {
  if (!id || typeof id !== 'string' || id.startsWith('<')) return null;
  const parts = id.replace(/\[.*\]$/, '').replace(/^claude-/, '').split('-').filter((p) => !/^\d{8}$/.test(p));
  const family = parts.find((p) => /^[a-z]+$/i.test(p));
  if (!family) return id;
  const version = parts.filter((p) => /^\d+$/.test(p)).join('.');
  return `${family[0].toUpperCase()}${family.slice(1)}${version ? ' ' + version : ''}`;
}

// Latest model used in this session, read from the tail of the transcript.
function modelFromTranscript(file) {
  if (!file) return null;
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const matches = [...buf.toString().matchAll(/"model":"(claude-[^"]+)"/g)];
    return matches.length ? matches[matches.length - 1][1] : null;
  } catch { return null; }
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    if (!loadConfig().enabled) return;
    const ev = JSON.parse(raw || '{}');
    const id = String(ev.session_id || 'unknown').replace(/[^\w-]/g, '');
    const file = path.join(SESSIONS, `${id}.json`);
    fs.mkdirSync(SESSIONS, { recursive: true });

    if (ev.hook_event_name === 'SessionEnd') {
      fs.rmSync(file, { force: true });
      return;
    }

    let s = {};
    try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    const now = Date.now();
    s.sessionId = id;
    s.startedAt = s.startedAt || now;
    s.updatedAt = now;
    const evModel = typeof ev.model === 'string' ? ev.model : ev.model?.id;
    s.model = prettyModel(modelFromTranscript(ev.transcript_path)) || prettyModel(evModel) || s.model || null;

    switch (ev.hook_event_name) {
      case 'SessionStart': s.activity = { verb: 'idle', text: 'Starting a session' }; break;
      case 'UserPromptSubmit': s.activity = { verb: 'think', text: 'Thinking…' }; break;
      case 'PreToolUse': s.activity = describeTool(ev.tool_name || 'tool', ev.tool_input); break;
      case 'PostToolUse': s.activity = { verb: 'think', text: 'Thinking…' }; break;
      case 'Stop': case 'Notification': s.activity = { verb: 'idle', text: 'Waiting for input' }; break;
    }

    fs.writeFileSync(file, JSON.stringify(s));
    startDaemon();
  } catch {
    // never break Claude Code over presence
  }
});
