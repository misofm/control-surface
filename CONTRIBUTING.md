# Contributing

Thanks for helping improve `@misofm/control-surface`.

## Development setup

Install [Bun](https://bun.sh/) and run:

```sh
bun install
bun run typecheck
bun run test
bun run build
```

## Pull requests

- Keep device wire codecs independent from application behavior.
- Add byte-level tests for every decoded input or encoded output.
- Add lifecycle tests for permission, connection, disconnection, and hot-plug
  behavior when those paths change.
- Document whether hardware behavior is verified, reported by another
  implementation, or still a candidate requiring a physical trace.
- Avoid introducing framework dependencies into a driver.

For hardware-facing changes, include the device model, firmware version,
connection mode, and a minimal MIDI trace in the pull request description.

## Scope

This repository provides control-surface drivers and transports. DAW session
models, track banking policy, parameter assignments, and product UI belong in
the host application.
