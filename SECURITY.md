# Security Policy

## Supported versions

Only the latest release gets security fixes. Update with `/plugin update discord-presence@discord-presence`.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report them privately through [GitHub Security Advisories](https://github.com/purposewalks9/claude-code-discord-presence/security/advisories/new). You'll get an initial response within 7 days. After a fix is released, you'll be credited unless you prefer otherwise.

## Scope

The plugin runs locally. It executes on Claude Code hook events, writes only under `~/.claude/discord-presence/`, and talks only to the local Discord IPC socket. Relevant reports include:

- data leaking to Discord beyond the documented status, model and start time
- writes outside the data directory
- code execution through crafted hook input or session files
