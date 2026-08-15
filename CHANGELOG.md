# Changelog

All notable changes to this project will be documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-08-16

### Changed

- Publish compiled output through the npm package instead of committing it to
  the source repository.
- Build release artifacts during `npm pack` and `npm publish`.

## [0.1.1] - 2026-08-16

### Fixed

- Include compiled output in the repository so direct GitHub dependencies work
  when package lifecycle scripts are disabled.

## [0.1.0] - 2026-08-16

### Added

- Typed Mackie Control input decoder and X-Touch feedback encoders.
- Normalized 14-bit fader conversion helpers.
- Full-size X-Touch Web MIDI discovery, permission, connection, hot-plug, and
  error lifecycle.
- Framework-independent device subscriptions for decoded input and connection
  state.
- Unit coverage for the wire codec and Web MIDI lifecycle.

[Unreleased]: https://github.com/misofm/control-surface/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/misofm/control-surface/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/misofm/control-surface/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/misofm/control-surface/releases/tag/v0.1.0
