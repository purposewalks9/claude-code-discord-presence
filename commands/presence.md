---
description: Control the Discord Rich Presence (status, restart, on, off, demo, set <key> <value>)
argument-hint: "[status|restart|on|off|demo [seconds]|set <key> <value>]"
allowed-tools: Bash(node:*)
---

Run this command with the Bash tool and show the user its output. Keep your reply short.

```
node "${CLAUDE_PLUGIN_ROOT}/bin/presence.js" $ARGUMENTS
```

If the output shows a connection error, tell the user to check that the Discord desktop app is running and that "Share your detected activities with others" is on in Discord → User Settings → Activity Privacy.
Settings that `set` accepts: `showFiles` (true/false), `smallImages` (true/false), `clientId` (a Discord application ID), `largeImage`, `largeText`.
