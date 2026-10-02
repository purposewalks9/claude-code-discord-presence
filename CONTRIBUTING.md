# Contributing

Thanks for helping improve Discord Presence for Claude Code. This guide covers everything you need to send a good pull request.

## Ground rules

- **All changes go through pull requests.** `main` is protected: it needs a passing CI run and an approving review from a code owner.
- **Keep it at zero dependencies.** Use plain CommonJS on Node.js 18+. Don't add runtime or dev dependencies.
- **Keep it cross-platform.** It must work on Linux, macOS and Windows. CI tests all three.
- **Don't break public interfaces.** The data dir (`~/.claude/discord-presence/`), config keys, session file format and slash command arguments are a public interface. Keep them compatible.
- **Respect privacy.** Never send project names, paths, prompts or code to Discord.

## Development setup

```bash
git clone https://github.com/<you>/claude-code-discord-presence.git
cd claude-code-discord-presence
npm test
```

To try your local copy inside Claude Code:

```text
/plugin marketplace add /absolute/path/to/claude-code-discord-presence
/plugin install discord-presence@discord-presence
```

To preview the card without a real session:

```bash
node bin/presence.js demo 30
```

To feed a single hook event into the hook, away from your real state:

```bash
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
echo '{"session_id":"t","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"/x/app.ts"}}' | sh scripts/run.sh
cat "$CLAUDE_CONFIG_DIR/discord-presence/sessions/t.json"
```

## Project layout

```text
.claude-plugin/plugin.json       Plugin manifest (name, version)
.claude-plugin/marketplace.json  Marketplace entry for /plugin marketplace add
hooks/hooks.json                 Runs scripts/run.sh on every hook event
commands/presence.md             The /discord-presence:presence slash command
scripts/run.sh                   Finds a Node.js binary and runs src/hook.js
bin/presence.js                  Control CLI: status, restart, on, off, demo, set
src/hook.js                      Hook entry point: updates the session file, starts the daemon
src/daemon.js                    Background loop: picks a session, keeps Discord in sync, exits when idle
src/daemon-control.js            Starts, stops and finds the daemon through its pidfile
src/config.js                    Data dir paths, settings defaults, config.json
src/states.js                    The status table: hook events and tools -> status text and icon
src/models.js                    Model id -> display name ("claude-opus-5-5" -> "Opus 5.5")
src/sessions.js                  Per-session state files (read, write, stale cleanup)
src/activity.js                  Which session to show, and its Discord activity payload
src/discord/ipc.js               Zero-dependency Discord IPC client
test/                            node:test suite (never touches ~/.claude or Discord)
```

## Common changes

### Add or change a status

Everything lives in `src/states.js`:

- **A new tool:** add one line to `TOOL_STATES`, for example `{ tools: ['LSP'], verb: 'search', text: 'Searching the codebase' }`.
- **A new hook event:** add one line to `EVENT_STATES`, then add the event to `hooks/hooks.json` if it isn't hooked yet.
- **A new verb:** add its corner icon key to `STATE_ICONS`.

Then add a test case in `test/states.test.js`.

### Support a new model name format

Update `formatModelName` in `src/models.js` and add cases to `test/models.test.js`.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>: <imperative summary, max 72 chars>

<optional body: what changed and why>
```

Use one of these types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `ci`, `chore`.
Write `feat: show subagent names in status`, not `added stuff` or `Fixed bug.`.

## Pull requests

1. Fork the repo and create a branch from `main`, for example `feat/subagent-names`.
2. Make your change and add or update tests.
3. Run `npm test`.
4. If the change is user-facing, update `README.md` and add an entry under **Unreleased** in `CHANGELOG.md`.
5. Open the PR and fill in the template. Keep each PR focused on one change.

Maintainers squash-merge PRs, so the PR title becomes the commit message. Write it as a Conventional Commit.

## Releases

These steps are for maintainers:

1. Bump `version` in `.claude-plugin/plugin.json`.
2. Move the **Unreleased** changelog entries under the new version.
3. Commit with `chore: release vX.Y.Z`.
4. Tag `vX.Y.Z` and push.

The release workflow publishes the GitHub release. Users get the update with `/plugin update`.
