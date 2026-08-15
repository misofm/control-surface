import {
  decodeMcuInput,
  isFullSizeXTouchPort,
  type McuInputMessage,
} from "./mcu.js";

export type XTouchConnectionStatus =
  | "unsupported"
  | "idle"
  | "requesting"
  | "searching"
  | "connecting"
  | "connected"
  | "error";

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

export function browserMidiRequest(): RequestMidiAccess | null {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.requestMIDIAccess !== "function"
  ) {
    return null;
  }
  return () => navigator.requestMIDIAccess({ sysex: true, software: false });
}

export function preferPhysicalMidiPort(port: MIDIPort): boolean {
  return !/simulator/i.test(port.name ?? "");
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "MIDI access was denied. Allow MIDI for this site and try again.";
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function findPort<Port extends MIDIPort>(
  ports: { forEach(callback: (port: Port) => void): void },
  preferPort: PreferMidiPort,
): Port | null {
  let match: Port | null = null;
  ports.forEach((port) => {
    if (port.state !== "connected" || !isFullSizeXTouchPort(port)) return;
    if (match == null || (!preferPort(match) && preferPort(port))) match = port;
  });
  return match;
}

export class WebMidiXTouchDevice implements XTouchDevice {
  readonly #requestMidiAccess: RequestMidiAccess | null;
  readonly #preferMidiPort: PreferMidiPort;
  readonly #listeners = new Set<() => void>();
  readonly #inputListeners = new Set<(message: McuInputMessage) => void>();

  #snapshot: XTouchDeviceSnapshot;
  #access: MIDIAccess | null = null;
  #input: MIDIInput | null = null;
  #output: MIDIOutput | null = null;
  #enabled = false;
  #connectionAttempt = 0;
  #portConnectionAttempt = 0;

  constructor(options: WebMidiXTouchDeviceOptions = {}) {
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

  getSnapshot = (): XTouchDeviceSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  subscribeInput = (
    listener: (message: McuInputMessage) => void,
  ): (() => void) => {
    this.#inputListeners.add(listener);
    return () => this.#inputListeners.delete(listener);
  };

  connect = async (): Promise<void> => {
    if (this.#requestMidiAccess == null) return;
    if (
      this.#snapshot.status === "requesting" ||
      this.#snapshot.status === "connected"
    ) {
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
      if (!this.#enabled || attempt !== this.#connectionAttempt) return;
      this.#detachAccess();
      this.#access = access;
      this.#publish({ sysexEnabled: access.sysexEnabled });
      access.addEventListener("statechange", this.#handlePortStateChange);
      await this.#scanPorts();
    } catch (error) {
      if (!this.#enabled || attempt !== this.#connectionAttempt) return;
      this.#enabled = false;
      this.#publish({ status: "error", error: errorMessage(error) });
    }
  };

  disconnect = (): void => {
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

  send = (message: readonly number[]): void => {
    try {
      this.#output?.send([...message]);
    } catch (error) {
      this.#publish({ status: "error", error: errorMessage(error) });
    }
  };

  readonly #publish = (patch: Partial<XTouchDeviceSnapshot>): void => {
    const next = { ...this.#snapshot, ...patch };
    if (
      next.supported === this.#snapshot.supported &&
      next.status === this.#snapshot.status &&
      next.deviceName === this.#snapshot.deviceName &&
      next.error === this.#snapshot.error &&
      next.sysexEnabled === this.#snapshot.sysexEnabled
    ) {
      return;
    }
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  };

  readonly #handlePortStateChange = (): void => {
    if (this.#enabled) void this.#scanPorts();
  };

  readonly #handleMidiMessage = (event: MIDIMessageEvent): void => {
    if (!event.data) return;
    const message = decodeMcuInput(event.data);
    if (!message) return;
    for (const listener of this.#inputListeners) listener(message);
  };

  async #scanPorts(): Promise<void> {
    if (!this.#access) return;
    const input = findPort<MIDIInput>(
      this.#access.inputs,
      this.#preferMidiPort,
    );
    const output = findPort<MIDIOutput>(
      this.#access.outputs,
      this.#preferMidiPort,
    );

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
      if (this.#snapshot.status === "connecting") return;
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
    } catch (error) {
      if (attempt !== this.#portConnectionAttempt) return;
      this.#detachPorts();
      this.#publish({
        status: "error",
        deviceName: input.name ?? output.name ?? "X-Touch",
        error: `Unable to open the X-Touch MIDI ports: ${errorMessage(error)}`,
      });
      return;
    }

    if (
      attempt !== this.#portConnectionAttempt ||
      !this.#enabled ||
      input !== this.#input ||
      output !== this.#output
    ) {
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

  #detachPorts(): void {
    this.#portConnectionAttempt += 1;
    if (this.#input) {
      this.#input.removeEventListener("midimessage", this.#handleMidiMessage);
      void this.#input.close().catch(() => undefined);
    }
    if (this.#output) void this.#output.close().catch(() => undefined);
    this.#input = null;
    this.#output = null;
  }

  #detachAccess(): void {
    this.#access?.removeEventListener(
      "statechange",
      this.#handlePortStateChange,
    );
    this.#detachPorts();
    this.#access = null;
  }
}
