const test = require('node:test');
const assert = require('node:assert');
const { describeTool, describeEvent, textWithoutFile, iconFor } = require('../src/states');

test('file tools show the file name', () => {
  assert.deepStrictEqual(describeTool('Edit', { file_path: '/x/app.ts' }), { verb: 'edit', text: 'Editing app.ts', file: 'app.ts' });
  assert.deepStrictEqual(describeTool('Write', { file_path: 'C:/src/main.py' }), { verb: 'edit', text: 'Editing main.py', file: 'main.py' });
  assert.deepStrictEqual(describeTool('NotebookEdit', { notebook_path: '/n/a.ipynb' }), { verb: 'edit', text: 'Editing a.ipynb', file: 'a.ipynb' });
  assert.deepStrictEqual(describeTool('Read', { file_path: '/x/README.md' }), { verb: 'read', text: 'Reading README.md', file: 'README.md' });
});

test('file tools without a file fall back to generic text', () => {
  assert.deepStrictEqual(describeTool('Edit', {}), { verb: 'edit', text: 'Editing code', file: null });
  assert.deepStrictEqual(describeTool('Read'), { verb: 'read', text: 'Reading code', file: null });
});

test('other known tools map to fixed states', () => {
  assert.deepStrictEqual(describeTool('Bash', { command: 'ls' }), { verb: 'bash', text: 'Running commands' });
  assert.deepStrictEqual(describeTool('PowerShell'), { verb: 'bash', text: 'Running commands' });
  assert.deepStrictEqual(describeTool('Grep', { path: '/x' }), { verb: 'search', text: 'Searching the codebase' });
  assert.deepStrictEqual(describeTool('Glob'), { verb: 'search', text: 'Searching the codebase' });
  assert.deepStrictEqual(describeTool('WebFetch'), { verb: 'web', text: 'Browsing the web' });
  assert.deepStrictEqual(describeTool('WebSearch'), { verb: 'web', text: 'Browsing the web' });
  assert.deepStrictEqual(describeTool('Agent'), { verb: 'agent', text: 'Running subagents' });
  assert.deepStrictEqual(describeTool('Task'), { verb: 'agent', text: 'Running subagents' });
});

test('unknown and MCP tools show "Using <tool>"', () => {
  assert.deepStrictEqual(describeTool('Skill'), { verb: 'tool', text: 'Using Skill' });
  assert.deepStrictEqual(describeTool('mcp__claude_ai_Gmail__send_email'), { verb: 'tool', text: 'Using send_email' });
  assert.deepStrictEqual(describeTool('mcp__github'), { verb: 'tool', text: 'Using github' });
});

test('hook events map to states', () => {
  assert.deepStrictEqual(describeEvent('SessionStart'), { verb: 'idle', text: 'Starting a session' });
  assert.deepStrictEqual(describeEvent('UserPromptSubmit'), { verb: 'think', text: 'Thinking…' });
  assert.deepStrictEqual(describeEvent('PostToolUse'), { verb: 'think', text: 'Thinking…' });
  assert.deepStrictEqual(describeEvent('Stop'), { verb: 'idle', text: 'Waiting for input' });
  assert.deepStrictEqual(describeEvent('Notification'), { verb: 'idle', text: 'Waiting for input' });
  assert.strictEqual(describeEvent('SomethingNew'), undefined);
});

test('textWithoutFile and iconFor', () => {
  assert.strictEqual(textWithoutFile('edit'), 'Editing code');
  assert.strictEqual(textWithoutFile('read'), 'Reading code');
  assert.strictEqual(iconFor('bash'), 'terminal');
  assert.strictEqual(iconFor('think'), 'thinking');
  assert.strictEqual(iconFor('nope'), 'tool');
});
