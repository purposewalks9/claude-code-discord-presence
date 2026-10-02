# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Contribution guidelines, code of conduct, security policy, issue and PR templates.
- CI on Linux, macOS and Windows with Node.js 18, 20 and 22.
- Card preview image in the README.

## [1.2.1] - 2026-10-02

### Fixed

- Restored the elapsed time on the presence card.
- A crashed session no longer overrides live sessions for 30 minutes.

## [1.2.0] - 2026-10-02

### Changed

- Split the source into focused modules.
- The card shows only the app name, the status and the model.
- One presence covers all Claude Code sessions on the machine, and a working session takes priority over an idle one.

### Added

- `node:test` suite covering models, states, activity, IPC framing, hooks and storage.

## [1.1.0] - 2026-10-02

### Added

- `activityType` setting: `playing`, `watching`, `listening` or `competing`.

## [1.0.0] - 2026-10-02

### Added

- First release: live Claude status and active model as Discord Rich Presence.

[Unreleased]: https://github.com/purposewalks9/claude-code-discord-presence/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/purposewalks9/claude-code-discord-presence/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/purposewalks9/claude-code-discord-presence/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/purposewalks9/claude-code-discord-presence/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/purposewalks9/claude-code-discord-presence/releases/tag/v1.0.0
