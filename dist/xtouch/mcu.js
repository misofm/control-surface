export const MCU_CHANNEL_COUNT = 8;
export const MCU_MASTER_FADER = 8;
export const MCU_FADER_MAX = 0x3fff;
const MCU_ENCODER_CC_FIRST = 0x10;
const MCU_ENCODER_CC_LAST = 0x17;
const MCU_ENCODER_RING_CC_FIRST = 0x30;
const MCU_ENCODER_PRESS_NOTE_FIRST = 0x20;
const MCU_ENCODER_PRESS_NOTE_LAST = 0x27;
const MCU_REC_NOTE_FIRST = 0x00;
const MCU_SOLO_NOTE_FIRST = 0x08;
const MCU_MUTE_NOTE_FIRST = 0x10;
const MCU_SELECT_NOTE_FIRST = 0x18;
const MCU_FADER_TOUCH_NOTE_FIRST = 0x68;
const MCU_FADER_TOUCH_NOTE_LAST = 0x70;
const MCU_JOG_CC = 0x3c;
const MCU_TRANSPORT_NOTE_FIRST = 0x5b;
const MCU_TRANSPORT_NOTE_LAST = 0x5f;
const MCU_LCD_ROW_LENGTH = 56;
const MCU_LCD_CELL_LENGTH = 7;
const MCU_METER_THRESHOLDS = [
    -60, -50, -40, -30, -20, -14, -10, -8, -6, -4, -2, 0,
];
export function decodeMcuInput(data) {
    if (data.length < 3)
        return null;
    const status = data[0] ?? 0;
    const type = status & 0xf0;
    const channel = status & 0x0f;
    const first = data[1] ?? 0;
    const second = data[2] ?? 0;
    if (type === 0xe0 && channel <= MCU_MASTER_FADER) {
        return {
            type: "fader",
            fader: channel,
            position: Math.min(MCU_FADER_MAX, first | (second << 7)),
        };
    }
    if (type === 0xb0 &&
        channel === 0 &&
        first >= MCU_ENCODER_CC_FIRST &&
        first <= MCU_ENCODER_CC_LAST) {
        const magnitude = second & 0x3f;
        if (magnitude === 0)
            return null;
        return {
            type: "encoder",
            encoder: first - MCU_ENCODER_CC_FIRST,
            delta: second & 0x40 ? -magnitude : magnitude,
        };
    }
    if (type === 0xb0 && channel === 0 && first === MCU_JOG_CC) {
        const magnitude = second & 0x3f;
        if (magnitude === 0)
            return null;
        return {
            type: "jog",
            delta: second & 0x40 ? -magnitude : magnitude,
        };
    }
    if ((type !== 0x80 && type !== 0x90) || channel !== 0)
        return null;
    const pressed = type === 0x90 && second > 0;
    if (first >= MCU_FADER_TOUCH_NOTE_FIRST &&
        first <= MCU_FADER_TOUCH_NOTE_LAST) {
        return {
            type: "fader-touch",
            fader: first - MCU_FADER_TOUCH_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_REC_NOTE_FIRST && first < MCU_REC_NOTE_FIRST + 8) {
        return {
            type: "channel-button",
            button: "rec",
            channel: first - MCU_REC_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_ENCODER_PRESS_NOTE_FIRST &&
        first <= MCU_ENCODER_PRESS_NOTE_LAST) {
        return {
            type: "encoder-press",
            encoder: first - MCU_ENCODER_PRESS_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_SOLO_NOTE_FIRST && first < MCU_SOLO_NOTE_FIRST + 8) {
        return {
            type: "channel-button",
            button: "solo",
            channel: first - MCU_SOLO_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_MUTE_NOTE_FIRST && first < MCU_MUTE_NOTE_FIRST + 8) {
        return {
            type: "channel-button",
            button: "mute",
            channel: first - MCU_MUTE_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_SELECT_NOTE_FIRST && first < MCU_SELECT_NOTE_FIRST + 8) {
        return {
            type: "channel-button",
            button: "select",
            channel: first - MCU_SELECT_NOTE_FIRST,
            pressed,
        };
    }
    if (first >= MCU_TRANSPORT_NOTE_FIRST && first <= MCU_TRANSPORT_NOTE_LAST) {
        const buttons = [
            "rewind",
            "fast-forward",
            "stop",
            "play",
            "record",
        ];
        return {
            type: "transport-button",
            button: buttons[first - MCU_TRANSPORT_NOTE_FIRST],
            pressed,
        };
    }
    if (!pressed)
        return null;
    if (first === 0x2e)
        return { type: "bank-shift", delta: -8 };
    if (first === 0x2f)
        return { type: "bank-shift", delta: 8 };
    if (first === 0x30)
        return { type: "bank-shift", delta: -1 };
    if (first === 0x31)
        return { type: "bank-shift", delta: 1 };
    return null;
}
export function mcuFaderPositionToFraction(position) {
    return Math.min(MCU_FADER_MAX, Math.max(0, position)) / MCU_FADER_MAX;
}
export function faderFractionToMcuFaderPosition(fraction) {
    return Math.round(Math.min(1, Math.max(0, fraction)) * MCU_FADER_MAX);
}
export function mcuFaderMessage(fader, position) {
    const safeFader = Math.min(MCU_MASTER_FADER, Math.max(0, fader));
    const safePosition = Math.min(MCU_FADER_MAX, Math.max(0, Math.round(position)));
    return [0xe0 | safeFader, safePosition & 0x7f, (safePosition >> 7) & 0x7f];
}
export function mcuEncoderRingMessage(encoder, pan) {
    const safeEncoder = Math.min(MCU_CHANNEL_COUNT - 1, Math.max(0, encoder));
    const position = Math.round(((Math.min(1, Math.max(-1, pan)) + 1) / 2) * 10);
    return [0xb0, MCU_ENCODER_RING_CC_FIRST + safeEncoder, position + 1];
}
export function mcuEncoderRingOffMessage(encoder) {
    const safeEncoder = Math.min(MCU_CHANNEL_COUNT - 1, Math.max(0, encoder));
    return [0xb0, MCU_ENCODER_RING_CC_FIRST + safeEncoder, 0];
}
export function mcuChannelButtonLedMessage(button, channel, active) {
    const safeChannel = Math.min(MCU_CHANNEL_COUNT - 1, Math.max(0, channel));
    const firstNotes = {
        rec: MCU_REC_NOTE_FIRST,
        solo: MCU_SOLO_NOTE_FIRST,
        mute: MCU_MUTE_NOTE_FIRST,
        select: MCU_SELECT_NOTE_FIRST,
    };
    const firstNote = firstNotes[button];
    return [0x90, firstNote + safeChannel, active ? 0x7f : 0];
}
export function mcuTransportLedMessage(button, active) {
    const notes = {
        rewind: 0x5b,
        "fast-forward": 0x5c,
        stop: 0x5d,
        play: 0x5e,
        record: 0x5f,
    };
    return [0x90, notes[button], active ? 0x7f : 0];
}
export function mcuGlobalLedMessage(led, active) {
    const notes = {
        smpte: 0x71,
        beats: 0x72,
        "rude-solo": 0x73,
    };
    return [0x90, notes[led], active ? 0x7f : 0];
}
function mcuDisplayDigitMessage(cc, character, dot) {
    const code = character.charCodeAt(0);
    const displayCode = code >= 0x20 && code <= 0x5f ? code & 0x3f : 0x20;
    return [0xb0, cc, displayCode | (dot ? 0x40 : 0)];
}
export function mcuTimeDisplayDigitMessage(position, character, dot = false) {
    const safePosition = Math.min(9, Math.max(0, position));
    return mcuDisplayDigitMessage(0x49 - safePosition, character, dot);
}
export function mcuAssignmentDisplayDigitMessage(position, character, dot = false) {
    const safePosition = Math.min(1, Math.max(0, position));
    return mcuDisplayDigitMessage(0x4b - safePosition, character, dot);
}
export function xTouchColorMessage(colors) {
    const values = {
        black: 0,
        red: 1,
        green: 2,
        yellow: 3,
        blue: 4,
        magenta: 5,
        cyan: 6,
        white: 7,
    };
    return [
        0xf0,
        0x00,
        0x00,
        0x66,
        0x14,
        0x72,
        ...Array.from({ length: MCU_CHANNEL_COUNT }, (_, index) => values[colors[index] ?? "black"]),
        0xf7,
    ];
}
function lcdCharacterCode(character) {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e ? code : 0x20;
}
export function mcuLcdCellMessage(channel, row, text) {
    const safeChannel = Math.min(MCU_CHANNEL_COUNT - 1, Math.max(0, channel));
    const cell = text
        .slice(0, MCU_LCD_CELL_LENGTH)
        .padEnd(MCU_LCD_CELL_LENGTH, " ");
    const offset = row * MCU_LCD_ROW_LENGTH + safeChannel * MCU_LCD_CELL_LENGTH;
    return [
        0xf0,
        0x00,
        0x00,
        0x66,
        0x14,
        0x12,
        offset,
        ...Array.from(cell, lcdCharacterCode),
        0xf7,
    ];
}
export function dbToMcuMeterLevel(db) {
    let level = 0;
    for (const threshold of MCU_METER_THRESHOLDS) {
        if (db < threshold)
            break;
        level += 1;
    }
    return level;
}
export function mcuMeterMessage(channel, db) {
    const safeChannel = Math.min(MCU_CHANNEL_COUNT - 1, Math.max(0, channel));
    return [0xd0, (safeChannel << 4) | dbToMcuMeterLevel(db)];
}
export function isFullSizeXTouchPort(port) {
    const descriptor = `${port.manufacturer ?? ""} ${port.name ?? ""}`;
    return (/x[\s_-]?touch/i.test(descriptor) &&
        !/compact|mini|one|extender|\bext\b|midi\s*(?:in|out)?\s*2\b/i.test(descriptor));
}
//# sourceMappingURL=mcu.js.map