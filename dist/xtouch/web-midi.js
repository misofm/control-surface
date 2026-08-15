import { decodeMcuInput, isFullSizeXTouchPort, } from "./mcu.js";
export function browserMidiRequest() {
    if (typeof navigator === "undefined" ||
        typeof navigator.requestMIDIAccess !== "function") {
        return null;
    }
    return () => navigator.requestMIDIAccess({ sysex: true, software: false });
}
export function preferPhysicalMidiPort(port) {
    return !/simulator/i.test(port.name ?? "");
}
function errorMessage(error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
        return "MIDI access was denied. Allow MIDI for this site and try again.";
    }
    if (error instanceof Error)
        return error.message;
    return String(error);
}
function findPort(ports, preferPort) {
    let match = null;
    ports.forEach((port) => {
        if (port.state !== "connected" || !isFullSizeXTouchPort(port))
            return;
        if (match == null || (!preferPort(match) && preferPort(port)))
            match = port;
    });
    return match;
}
export class WebMidiXTouchDevice {
    #requestMidiAccess;
    #preferMidiPort;
    #listeners = new Set();
    #inputListeners = new Set();
    #snapshot;
    #access = null;
    #input = null;
    #output = null;
    #enabled = false;
    #connectionAttempt = 0;
    #portConnectionAttempt = 0;
    constructor(options = {}) {
        this.#requestMidiAccess =
            options.requestMidiAccess === undefined
                ? browserMidiRequest()
                : options.requestMidiAccess;
        this.#preferMidiPort = options.preferPort ?? preferPhysicalMidiPort;
        const supported = this.#requestMidiAccess != null;
        this.#snapshot = {
            supported,
            status: supported ? "idle" : "unsupported",
            deviceName: null,
            error: supported
                ? null
                : "Web MIDI is unavailable. Use a supported browser over HTTPS.",
            sysexEnabled: false,
        };
    }
    getSnapshot = () => this.#snapshot;
    subscribe = (listener) => {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    };
    subscribeInput = (listener) => {
        this.#inputListeners.add(listener);
        return () => this.#inputListeners.delete(listener);
    };
    connect = async () => {
        if (this.#requestMidiAccess == null)
            return;
        if (this.#snapshot.status === "requesting" ||
            this.#snapshot.status === "connected") {
            return;
        }
        if (this.#access) {
            await this.#scanPorts();
            return;
        }
        const attempt = ++this.#connectionAttempt;
        this.#enabled = true;
        this.#publish({ status: "requesting", error: null });
        try {
            const access = await this.#requestMidiAccess();
            if (!this.#enabled || attempt !== this.#connectionAttempt)
                return;
            this.#detachAccess();
            this.#access = access;
            this.#publish({ sysexEnabled: access.sysexEnabled });
            access.addEventListener("statechange", this.#handlePortStateChange);
            await this.#scanPorts();
        }
        catch (error) {
            if (!this.#enabled || attempt !== this.#connectionAttempt)
                return;
            this.#enabled = false;
            this.#publish({ status: "error", error: errorMessage(error) });
        }
    };
    disconnect = () => {
        this.#enabled = false;
        this.#connectionAttempt += 1;
        this.#detachAccess();
        this.#publish({
            status: this.#snapshot.supported ? "idle" : "unsupported",
            deviceName: null,
            sysexEnabled: false,
            error: this.#snapshot.supported
                ? null
                : "Web MIDI is unavailable. Use a supported browser over HTTPS.",
        });
    };
    send = (message) => {
        try {
            this.#output?.send([...message]);
        }
        catch (error) {
            this.#publish({ status: "error", error: errorMessage(error) });
        }
    };
    #publish = (patch) => {
        const next = { ...this.#snapshot, ...patch };
        if (next.supported === this.#snapshot.supported &&
            next.status === this.#snapshot.status &&
            next.deviceName === this.#snapshot.deviceName &&
            next.error === this.#snapshot.error &&
            next.sysexEnabled === this.#snapshot.sysexEnabled) {
            return;
        }
        this.#snapshot = next;
        for (const listener of this.#listeners)
            listener();
    };
    #handlePortStateChange = () => {
        if (this.#enabled)
            void this.#scanPorts();
    };
    #handleMidiMessage = (event) => {
        if (!event.data)
            return;
        const message = decodeMcuInput(event.data);
        if (!message)
            return;
        for (const listener of this.#inputListeners)
            listener(message);
    };
    async #scanPorts() {
        if (!this.#access)
            return;
        const input = findPort(this.#access.inputs, this.#preferMidiPort);
        const output = findPort(this.#access.outputs, this.#preferMidiPort);
        if (!input || !output) {
            this.#detachPorts();
            this.#publish({
                status: "searching",
                deviceName: input?.name ?? output?.name ?? null,
                error: "Connect a full-size X-Touch in MC mode over USB.",
            });
            return;
        }
        if (input === this.#input && output === this.#output) {
            if (this.#snapshot.status === "connecting")
                return;
            this.#publish({
                status: "connected",
                deviceName: input.name ?? output.name ?? "X-Touch",
                error: null,
            });
            return;
        }
        this.#detachPorts();
        const attempt = ++this.#portConnectionAttempt;
        this.#input = input;
        this.#output = output;
        this.#publish({
            status: "connecting",
            deviceName: input.name ?? output.name ?? "X-Touch",
            error: null,
        });
        try {
            await Promise.all([input.open(), output.open()]);
        }
        catch (error) {
            if (attempt !== this.#portConnectionAttempt)
                return;
            this.#detachPorts();
            this.#publish({
                status: "error",
                deviceName: input.name ?? output.name ?? "X-Touch",
                error: `Unable to open the X-Touch MIDI ports: ${errorMessage(error)}`,
            });
            return;
        }
        if (attempt !== this.#portConnectionAttempt ||
            !this.#enabled ||
            input !== this.#input ||
            output !== this.#output) {
            void input.close().catch(() => undefined);
            void output.close().catch(() => undefined);
            return;
        }
        input.addEventListener("midimessage", this.#handleMidiMessage);
        this.#publish({
            status: "connected",
            deviceName: input.name ?? output.name ?? "X-Touch",
            error: null,
        });
    }
    #detachPorts() {
        this.#portConnectionAttempt += 1;
        if (this.#input) {
            this.#input.removeEventListener("midimessage", this.#handleMidiMessage);
            void this.#input.close().catch(() => undefined);
        }
        if (this.#output)
            void this.#output.close().catch(() => undefined);
        this.#input = null;
        this.#output = null;
    }
    #detachAccess() {
        this.#access?.removeEventListener("statechange", this.#handlePortStateChange);
        this.#detachPorts();
        this.#access = null;
    }
}
//# sourceMappingURL=web-midi.js.map