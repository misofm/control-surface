import { type McuInputMessage } from "./mcu.js";
export type XTouchConnectionStatus = "unsupported" | "idle" | "requesting" | "searching" | "connecting" | "connected" | "error";
export interface XTouchDeviceSnapshot {
    supported: boolean;
    status: XTouchConnectionStatus;
    deviceName: string | null;
    error: string | null;
    sysexEnabled: boolean;
}
export type RequestMidiAccess = () => Promise<MIDIAccess>;
export type PreferMidiPort = (port: MIDIPort) => boolean;
export interface XTouchDevice {
    getSnapshot(): XTouchDeviceSnapshot;
    subscribe(listener: () => void): () => void;
    subscribeInput(listener: (message: McuInputMessage) => void): () => void;
    connect(): Promise<void>;
    disconnect(): void;
    send(message: readonly number[]): void;
}
export interface WebMidiXTouchDeviceOptions {
    requestMidiAccess?: RequestMidiAccess | null;
    preferPort?: PreferMidiPort;
}
export declare function browserMidiRequest(): RequestMidiAccess | null;
export declare function preferPhysicalMidiPort(port: MIDIPort): boolean;
export declare class WebMidiXTouchDevice implements XTouchDevice {
    #private;
    constructor(options?: WebMidiXTouchDeviceOptions);
    getSnapshot: () => XTouchDeviceSnapshot;
    subscribe: (listener: () => void) => (() => void);
    subscribeInput: (listener: (message: McuInputMessage) => void) => (() => void);
    connect: () => Promise<void>;
    disconnect: () => void;
    send: (message: readonly number[]) => void;
}
//# sourceMappingURL=web-midi.d.ts.map