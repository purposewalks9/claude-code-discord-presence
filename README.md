# Discord Presence for Claude Code

**Unofficial** Discord Rich Presence for [Claude Code](https://claude.com/claude-code). Your Discord profile shows what Claude is doing right now and which model it's using.

```
Playing Claude Code
  Editing app.ts
  Opus 5.5
  12:04 elapsed
```

Live states: **Thinking…**, **Editing / Reading `<file>`**, **Searching the codebase**, **Running commands**, **Browsing the web**, **Running subagents**, **Using `<tool>`**, **Waiting for input**.
The model updates automatically when you switch with `/model`.

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
| `largeImage` / `largeText` | `claude` / `Claude Code` | Big image asset key and hover text |

## Privacy

- Only the current action, file name (unless `showFiles` is false) and model name are sent, and only to your local Discord app.
- Project names, paths, prompts and code are never sent.
- Nothing goes over the network except through Discord itself.

## How it works

1. Claude Code hooks (`SessionStart`, `UserPromptSubmit`, `Pre/PostToolUse`, `Stop`, `Notification`, `SessionEnd`) write a small state file per session to `~/.claude/discord-presence/sessions/`.
2. A tiny background daemon talks to Discord's local IPC socket directly. It has no dependencies.
3. The daemon shows the most recently active session, and exits after 5 minutes with no sessions. The next hook restarts it.

## Troubleshooting

- **Nothing shows:** run `/discord-presence:presence` and check the log lines.
  - `socket not found` means the Discord desktop app isn't running. Flatpak and Snap Discord are supported.
  - Also check the Activity Privacy setting above.
- **Status is stuck:** run `/discord-presence:presence restart`.
- **Windows:** hooks need a POSIX `sh`. Git for Windows provides one, and Claude Code on Windows already uses it.

## Uninstall

```
/plugin uninstall discord-presence@discord-presence
```

Then delete `~/.claude/discord-presence/`.

---

Not affiliated with Anthropic or Discord. "Claude" is a trademark of Anthropic.
MIT licensed.
