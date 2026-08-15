import { describe, expect, it } from "vitest";

import {
  dbToMcuMeterLevel,
  decodeMcuInput,
  faderFractionToMcuFaderPosition,
  isFullSizeXTouchPort,
  MCU_FADER_MAX,
  mcuAssignmentDisplayDigitMessage,
  mcuChannelButtonLedMessage,
  mcuEncoderRingMessage,
  mcuFaderMessage,
  mcuFaderPositionToFraction,
  mcuGlobalLedMessage,
  mcuLcdCellMessage,
  mcuMeterMessage,
  mcuTimeDisplayDigitMessage,
  mcuTransportLedMessage,
  xTouchColorMessage,
} from "./mcu.js";

describe("Mackie Control protocol", () => {
  it("decodes channel and master faders from 14-bit pitch bend", () => {
    expect(decodeMcuInput([0xe0, 0x00, 0x00])).toEqual({
      type: "fader",
      fader: 0,
      position: 0,
    });
    expect(decodeMcuInput([0xe8, 0x7f, 0x7f])).toEqual({
      type: "fader",
      fader: 8,
      position: MCU_FADER_MAX,
    });
  });

  it("decodes relative encoders, presses, touch, and bank buttons", () => {
    expect(decodeMcuInput([0xb0, 0x10, 0x01])).toEqual({
      type: "encoder",
      encoder: 0,
      delta: 1,
    });
    expect(decodeMcuInput([0xb0, 0x17, 0x41])).toEqual({
      type: "encoder",
      encoder: 7,
      delta: -1,
    });
    expect(decodeMcuInput([0x90, 0x20, 0x7f])).toEqual({
      type: "encoder-press",
      encoder: 0,
      pressed: true,
    });
    expect(decodeMcuInput([0x90, 0x68, 0x7f])).toEqual({
      type: "fader-touch",
      fader: 0,
      pressed: true,
    });
    expect(decodeMcuInput([0x90, 0x2f, 0x7f])).toEqual({
      type: "bank-shift",
      delta: 8,
    });
  });

  it("decodes channel mute and solo buttons, including releases", () => {
    expect(decodeMcuInput([0x90, 0x08, 0x7f])).toEqual({
      type: "channel-button",
      button: "solo",
      channel: 0,
      pressed: true,
    });
    expect(decodeMcuInput([0x90, 0x17, 0x7f])).toEqual({
      type: "channel-button",
      button: "mute",
      channel: 7,
      pressed: true,
    });
    expect(decodeMcuInput([0x80, 0x0f, 0])).toEqual({
      type: "channel-button",
      button: "solo",
      channel: 7,
      pressed: false,
    });
    expect(decodeMcuInput([0x90, 0x00, 0x7f])).toEqual({
      type: "channel-button",
      button: "rec",
      channel: 0,
      pressed: true,
    });
    expect(decodeMcuInput([0x90, 0x1f, 0x7f])).toEqual({
      type: "channel-button",
      button: "select",
      channel: 7,
      pressed: true,
    });
  });

  it("decodes jog and transport controls", () => {
    expect(decodeMcuInput([0xb0, 0x3c, 0x02])).toEqual({
      type: "jog",
      delta: 2,
    });
    expect(decodeMcuInput([0xb0, 0x3c, 0x43])).toEqual({
      type: "jog",
      delta: -3,
    });
    expect(decodeMcuInput([0x90, 0x5e, 0x7f])).toEqual({
      type: "transport-button",
      button: "play",
      pressed: true,
    });
    expect(decodeMcuInput([0x90, 0x5d, 0])).toEqual({
      type: "transport-button",
      button: "stop",
      pressed: false,
    });
  });

  it("round-trips normalized fader positions", () => {
    for (const fraction of [0, 0.1, 0.5, 0.72, 1]) {
      const position = faderFractionToMcuFaderPosition(fraction);
      expect(mcuFaderPositionToFraction(position)).toBeCloseTo(fraction, 4);
    }
    expect(mcuFaderMessage(8, MCU_FADER_MAX)).toEqual([0xe8, 0x7f, 0x7f]);
  });

  it("encodes pan rings and matches only the full-size X-Touch", () => {
    expect(mcuEncoderRingMessage(0, -1)).toEqual([0xb0, 0x30, 0x01]);
    expect(mcuEncoderRingMessage(3, 0)).toEqual([0xb0, 0x33, 0x06]);
    expect(mcuEncoderRingMessage(7, 1)).toEqual([0xb0, 0x37, 0x0b]);
    expect(
      isFullSizeXTouchPort({ manufacturer: "Behringer", name: "X-TOUCH" }),
    ).toBe(true);
    expect(
      isFullSizeXTouchPort({
        manufacturer: "Behringer",
        name: "X-TOUCH COMPACT",
      }),
    ).toBe(false);
    expect(
      isFullSizeXTouchPort({
        manufacturer: "BEHRINGER",
        name: "X-Touch INT",
      }),
    ).toBe(true);
    expect(
      isFullSizeXTouchPort({
        manufacturer: "BEHRINGER",
        name: "X-Touch EXT",
      }),
    ).toBe(false);
    expect(
      isFullSizeXTouchPort({
        manufacturer: "misofm",
        name: "X-Touch Simulator INT",
      }),
    ).toBe(true);
  });

  it("encodes mute/solo LEDs and seven-character LCD cells", () => {
    expect(mcuChannelButtonLedMessage("solo", 0, true)).toEqual([
      0x90, 0x08, 0x7f,
    ]);
    expect(mcuChannelButtonLedMessage("mute", 7, false)).toEqual([
      0x90, 0x17, 0,
    ]);
    expect(mcuLcdCellMessage(1, 0, "Vocals")).toEqual([
      0xf0, 0x00, 0x00, 0x66, 0x14, 0x12, 0x07, 0x56, 0x6f, 0x63, 0x61, 0x6c,
      0x73, 0x20, 0xf7,
    ]);
    expect(mcuLcdCellMessage(0, 1, "Lead Vocal")[6]).toBe(0x38);
  });

  it("encodes transport, global, time, assignment, and X-Touch color feedback", () => {
    expect(mcuChannelButtonLedMessage("select", 7, true)).toEqual([
      0x90, 0x1f, 0x7f,
    ]);
    expect(mcuTransportLedMessage("play", true)).toEqual([0x90, 0x5e, 0x7f]);
    expect(mcuGlobalLedMessage("rude-solo", true)).toEqual([0x90, 0x73, 0x7f]);
    expect(mcuTimeDisplayDigitMessage(9, "1", true)).toEqual([
      0xb0, 0x40, 0x71,
    ]);
    expect(mcuAssignmentDisplayDigitMessage(0, "P")).toEqual([
      0xb0, 0x4b, 0x10,
    ]);
    expect(
      xTouchColorMessage([
        "cyan",
        "white",
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
      ]),
    ).toEqual([
      0xf0, 0x00, 0x00, 0x66, 0x14, 0x72, 6, 7, 0, 1, 2, 3, 4, 5, 0xf7,
    ]);
  });

  it("quantizes dB levels into MCU channel-pressure meter messages", () => {
    expect(dbToMcuMeterLevel(-90)).toBe(0);
    expect(dbToMcuMeterLevel(-60)).toBe(1);
    expect(dbToMcuMeterLevel(-14)).toBe(6);
    expect(dbToMcuMeterLevel(-0.1)).toBe(11);
    expect(dbToMcuMeterLevel(0)).toBe(12);
    expect(mcuMeterMessage(0, -90)).toEqual([0xd0, 0x00]);
    expect(mcuMeterMessage(7, 0)).toEqual([0xd0, 0x7c]);
  });
});
