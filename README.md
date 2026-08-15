# `@misofm/control-surface`

[![CI](https://github.com/misofm/control-surface/actions/workflows/ci.yml/badge.svg)](https://github.com/misofm/control-surface/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Typed, framework-independent control-surface drivers for browser-based audio
applications.

The first driver supports the full-size Behringer X-Touch in Mackie Control
mode over Web MIDI. It provides a typed MCU/X-Touch wire codec and owns the
browser MIDI lifecycle without imposing a DAW session model, UI framework, or
parameter-mapping policy.

> [!NOTE]
> The package is at `0.1.x`. The X-Touch API is usable and tested, but the
> cross-device abstraction will be allowed to emerge as additional hardware
> drivers are implemented.

## Features

- Typed decoding for faders, fader touch, encoders, encoder presses, channel
  buttons, banking, transport, and jog input.
- Feedback encoders for motor faders, encoder rings, LEDs, meters, scribble
  strips, strip colors, and time/assignment displays.
- Web MIDI permission, SysEx, discovery, port-open, hot-plug, reconnect, and
  error handling.
- Framework-independent connection snapshots and input subscriptions.
- Dependency-free runtime with injectable MIDI access and port selection for
  deterministic tests.
- Separate host/application semantics: the driver never decides what a track,
  bank, plug-in page, or transport command means.

## Hardware support

| Device                        | Transport                               | Protocol       | Status                                 |
| ----------------------------- | --------------------------------------- | -------------- | -------------------------------------- |
| Behringer X-Touch, full-size  | Web MIDI endpoint identified as X-Touch | Mackie Control | Supported baseline                     |
| X-Touch Extender              | —                                       | —              | Not yet supported                      |
| X-Touch One, Compact, Mini    | —                                       | —              | Not supported by this driver           |
| Other MCU-compatible surfaces | —                                       | Mackie Control | Untested; compatibility is not claimed |

The full-size matcher intentionally rejects Extender and secondary `EXT` /
`MIDI 2` endpoints. Explicit selection of generically named MIDI-interface or
network-session endpoints is not implemented yet.

## Requirements

- A browser/runtime exposing the [Web MIDI API](https://www.w3.org/TR/webmidi/)
  in a secure context.
- User permission for MIDI access. The default X-Touch connection requests
  SysEx because scribble strips and strip colors require it.
- TypeScript projects should include the `DOM` library for Web MIDI types.
- A full-size X-Touch configured for Mackie Control (`MC`) mode.

Call `connect()` from a user-initiated action such as a button click so the
browser can present its permission UI.

## Installation

Until the first npm registry release, install directly from the public
repository:

```sh
bun add github:misofm/control-surface
```

The package is ESM-only and ships compiled JavaScript plus declarations.

## Quick start

```ts
import {
  WebMidiXTouchDevice,
  mcuChannelButtonLedMessage,
} from "@misofm/control-surface/xtouch";

const device = new WebMidiXTouchDevice();

const unsubscribeState = device.subscribe(() => {
  const state = device.getSnapshot();
  console.log(state.status, state.deviceName, state.error);
});

const unsubscribeInput = device.subscribeInput((event) => {
  switch (event.type) {
    case "fader":
      console.log(event.fader, event.position);
      break;
    case "transport-button":
      console.log(event.button, event.pressed);
      break;
  }
});

// Invoke from a user gesture.
await device.connect();

device.send(mcuChannelButtonLedMessage("select", 0, true));

unsubscribeInput();
unsubscribeState();
device.disconnect();
```

The device emits physical events and accepts MIDI feedback bytes. Your host
binding translates between those events and application state.

## API surface

| Entry point                               | Contents                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| `@misofm/control-surface`                 | Complete currently supported API                      |
| `@misofm/control-surface/xtouch`          | X-Touch codec and Web MIDI device                     |
| `@misofm/control-surface/xtouch/mcu`      | Byte-level decode/encode functions and protocol types |
| `@misofm/control-surface/xtouch/web-midi` | Connection lifecycle and device types                 |

### Connection state

`WebMidiXTouchDevice#getSnapshot()` returns:

```ts
interface XTouchDeviceSnapshot {
  supported: boolean;
  status:
    | "unsupported"
    | "idle"
    | "requesting"
    | "searching"
    | "connecting"
    | "connected"
    | "error";
  deviceName: string | null;
  error: string | null;
  sysexEnabled: boolean;
}
```

Use `subscribe()` with `getSnapshot()` directly from React's
`useSyncExternalStore`, another reactive adapter, or an imperative host.

### Testing and custom transports

MIDI access and port preference are injectable:

```ts
const device = new WebMidiXTouchDevice({
  requestMidiAccess: async () => testMidiAccess,
  preferPort: (port) => port.id === configuredPortId,
});
```

This is the same seam used by the repository tests; physical hardware is not
required for codec or lifecycle coverage.

## Architecture

The library keeps the boundaries deliberately narrow:

```text
host application binding
        ↓ semantic mapping
WebMidiXTouchDevice
        ↓ typed MCU events / feedback bytes
Web MIDI ports
        ↓
physical X-Touch
```

The package owns device and transport behavior. A host owns track banking,
fader curves, transport semantics, parameter assignments, display content, and
feedback scheduling. This prevents one application's console model from
becoming the API for every future hardware driver.

## Development

```sh
git clone https://github.com/misofm/control-surface.git
cd control-surface
bun install
bun run typecheck
bun run test
bun run build
```

Tests cover both the byte-level codec and Web MIDI lifecycle, including port
open failures. See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a
hardware-facing change.

## Safety and project status

This library does not send firmware and does not include firmware images.
Unknown incoming messages are ignored by the typed decoder. Applications remain
responsible for deciding when to connect and what feedback to send.

Mackie Control is a proprietary protocol. This implementation is based on
public documentation and hardware-tested interoperability references. This
project is not affiliated with or endorsed by Behringer, Music Tribe, or
Mackie.

## License

Licensed under the [Apache License 2.0](LICENSE).
