export declare const MCU_CHANNEL_COUNT = 8;
export declare const MCU_MASTER_FADER = 8;
export declare const MCU_FADER_MAX = 16383;
export type McuChannelButton = "rec" | "solo" | "mute" | "select";
export type McuTransportButton = "rewind" | "fast-forward" | "stop" | "play" | "record";
export type McuGlobalLed = "smpte" | "beats" | "rude-solo";
export type XTouchColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
export type McuInputMessage = {
    type: "fader";
    fader: number;
    position: number;
} | {
    type: "fader-touch";
    fader: number;
    pressed: boolean;
} | {
    type: "encoder";
    encoder: number;
    delta: number;
} | {
    type: "jog";
    delta: number;
} | {
    type: "encoder-press";
    encoder: number;
    pressed: boolean;
} | {
    type: "channel-button";
    button: McuChannelButton;
    channel: number;
    pressed: boolean;
} | {
    type: "bank-shift";
    delta: -8 | -1 | 1 | 8;
} | {
    type: "transport-button";
    button: McuTransportButton;
    pressed: boolean;
};
export interface MidiPortDescriptor {
    manufacturer: string | null;
    name: string | null;
}
export declare function decodeMcuInput(data: ArrayLike<number>): McuInputMessage | null;
export declare function mcuFaderPositionToFraction(position: number): number;
export declare function faderFractionToMcuFaderPosition(fraction: number): number;
export declare function mcuFaderMessage(fader: number, position: number): [number, number, number];
export declare function mcuEncoderRingMessage(encoder: number, pan: number): [number, number, number];
export declare function mcuEncoderRingOffMessage(encoder: number): [number, number, number];
export declare function mcuChannelButtonLedMessage(button: McuChannelButton, channel: number, active: boolean): [number, number, number];
export declare function mcuTransportLedMessage(button: McuTransportButton, active: boolean): [number, number, number];
export declare function mcuGlobalLedMessage(led: McuGlobalLed, active: boolean): [number, number, number];
export declare function mcuTimeDisplayDigitMessage(position: number, character: string, dot?: boolean): [number, number, number];
export declare function mcuAssignmentDisplayDigitMessage(position: number, character: string, dot?: boolean): [number, number, number];
export declare function xTouchColorMessage(colors: XTouchColor[]): number[];
export declare function mcuLcdCellMessage(channel: number, row: 0 | 1, text: string): number[];
export declare function dbToMcuMeterLevel(db: number): number;
export declare function mcuMeterMessage(channel: number, db: number): [number, number];
export declare function isFullSizeXTouchPort(port: MidiPortDescriptor): boolean;
//# sourceMappingURL=mcu.d.ts.map