# Discord Presence for Claude Code

**Unofficial** Discord Rich Presence for [Claude Code](https://claude.com/claude-code). Your Discord profile shows what Claude is doing right now and which model it's using.

```
Playing Claude Code
  Thinking…
  Opus 5.5
  12:04 elapsed
```

Live states: **Thinking…**, **Editing / Reading `<file>`**, **Searching the codebase**, **Running commands**, **Browsing the web**, **Running subagents**, **Using `<tool>`**, **Waiting for input**.
The model updates automatically when you switch with `/model`.

One presence covers the whole machine: every Claude Code session (all terminals, tabs, IDE and desktop sessions, and their subagents) feeds the same status. A session that is working wins over one that is waiting for input.

## Install

Inside Claude Code:

```
/plugin marketplace add purposewalks9/claude-code-discord-presence
/plugin install discord-presence@discord-presence
```

Restart Claude Code and send a message. That's it.

**Requirements:**
- The Discord desktop app, running on the same computer. The browser version can't show Rich Presence.
- Node.js 18 or newer.
- Discord → User Settings → Activity Privacy → **Share your detected activities with others** must be on.

## Commands

| Command | What it does |
|---|---|
| `/discord-presence:presence` | Shows status: daemon running, connection, current state |
| `/discord-presence:presence restart` | Restarts the connection to Discord |
| `/discord-presence:presence off` / `/discord-presence:presence on` | Turns the presence off and clears your status, or back on |
| `/discord-presence:presence demo 60` | Cycles through every state for 60 seconds so you can preview it |
| `/discord-presence:presence set showFiles false` | Shows "Editing code" instead of file names |

## Settings

These live in `~/.claude/discord-presence/config.json`. You can also change them with `/discord-presence:presence set <key> <value>`.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `activityType` | `playing` | `playing`, `watching`, `listening` or `competing` (the word before "Claude Code") |
| `showFiles` | `true` | Show file names in the status |
| `smallImages` | `false` | Per-state corner icons (needs matching art assets on your Discord app) |
| `clientId` | shared app | Use your own Discord application ID instead of the shared one |
| `largeImage` / `largeText` | `claude` / `Claude Code` | Big image asset key and its hover text |

## Privacy

- Only the current action, file name (unless `showFiles` is false) and model name are sent, and only to your local Discord app.
- Project names, paths, prompts and code are never sent.
- Nothing goes over the network except through Discord itself.

## How it works

1. Claude Code hooks (`SessionStart`, `UserPromptSubmit`, `Pre/PostToolUse`, `Stop`, `Notification`, `SessionEnd`) write a small state file per session to `~/.claude/discord-presence/sessions/`.
2. A tiny background daemon talks to Discord's local IPC socket directly. It has no dependencies.
3. The daemon shows one session for the whole machine: the most recently updated session that is working, or the most recently updated one if all are waiting for input. Subagent activity counts toward its parent session. The daemon exits after 5 minutes with no sessions, and the next hook restarts it.

## Troubleshooting

- **Nothing shows:** run `/discord-presence:presence` and check the log lines.
  - `socket not found` means the Discord desktop app isn't running. Flatpak and Snap Discord are supported.
  - Also check the Activity Privacy setting above.
- **Status is stuck:** run `/discord-presence:presence restart`.
- **Windows:** hooks need a POSIX `sh`. Git for Windows provides one, and Claude Code on Windows already uses it.

## Project layout

```
.claude-plugin/plugin.json       Plugin manifest (name, version)
.claude-plugin/marketplace.json  Marketplace entry, so the repo can be added with /plugin marketplace add
hooks/hooks.json                 Runs scripts/run.sh on every hook event
commands/presence.md             The /discord-presence:presence slash command
scripts/run.sh                   Finds a Node.js binary (nvm, volta, fnm, asdf, homebrew) and runs src/hook.js
bin/presence.js                  Control CLI: status, restart, on, off, demo, set
src/hook.js                      Hook entry point: updates the session file, starts the daemon
src/daemon.js                    Background loop: picks a session, keeps Discord in sync, exits when idle
src/daemon-control.js            Start, stop and find the daemon through its pidfile
src/config.js                    Data dir paths, settings defaults and config.json
src/states.js                    The status table: hook events and tools -> status text and icon
src/models.js                    Model id -> display name ("claude-opus-5-5" -> "Opus 5.5")
src/sessions.js                  Per-session state files (read, write, stale cleanup)
src/activity.js                  Which session to show, and the Discord activity payload for it
src/discord/ipc.js               Zero-dependency Discord IPC client (socket discovery, framing, handshake)
test/                            node:test suite
```

## Contributing

- There are no dependencies. Plain CommonJS on Node.js 18+, and it must keep working on Linux, macOS and Windows.
- Run the tests with `npm test` (or `node --test`). They use a temp `CLAUDE_CONFIG_DIR` and never connect to Discord.
- **Add or change a state:** edit the tables in `src/states.js`. A new tool is one line in `TOOL_STATES`, for example `{ tools: ['LSP'], verb: 'search', text: 'Searching the codebase' }`. A new hook event is one line in `EVENT_STATES` (and add the event to `hooks/hooks.json` if it isn't hooked yet). A new verb also gets a corner icon in `STATE_ICONS`. Add a test in `test/states.test.js`.
- **Try it without a real session:** `node bin/presence.js demo 30` cycles through every state, or pipe a hook event into the hook: `echo '{"session_id":"t","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"/x/app.ts"}}' | sh scripts/run.sh`. Set `CLAUDE_CONFIG_DIR` to a temp dir to keep it away from your real state.
- The data dir, config keys, session file format and slash command arguments are a public interface; keep them compatible.

## Uninstall

```
/plugin uninstall discord-presence@discord-presence
```

Then delete `~/.claude/discord-presence/`.

---

Not affiliated with Anthropic or Discord. "Claude" is a trademark of Anthropic.
MIT licensed.
