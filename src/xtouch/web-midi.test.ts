import { describe, expect, it, vi } from "vitest";

import { WebMidiXTouchDevice } from "./web-midi.js";

class TestMidiInput extends EventTarget {
  readonly manufacturer = "Behringer";
  readonly name = "X-TOUCH";
  readonly state = "connected";
  readonly open: ReturnType<typeof vi.fn>;
  readonly close = vi.fn(async () => this);

  constructor(openError?: Error) {
    super();
    this.open = vi.fn(async () => {
      if (openError) throw openError;
      return this;
    });
  }

  emit(data: number[]): void {
    const event = new Event("midimessage");
    Object.defineProperty(event, "data", { value: new Uint8Array(data) });
    this.dispatchEvent(event);
  }
}

class TestMidiOutput extends EventTarget {
  readonly manufacturer = "Behringer";
  readonly name = "X-TOUCH";
  readonly state = "connected";
  readonly messages: number[][] = [];
  readonly open = vi.fn(async () => this);
  readonly close = vi.fn(async () => this);

  send(data: number[]): void {
    this.messages.push([...data]);
  }
}

class TestMidiAccess extends EventTarget {
  readonly sysexEnabled = true;
  readonly inputs: Map<string, TestMidiInput>;
  readonly outputs: Map<string, TestMidiOutput>;

  constructor(
    readonly input = new TestMidiInput(),
    readonly output = new TestMidiOutput(),
  ) {
    super();
    this.inputs = new Map([["input", input]]);
    this.outputs = new Map([["output", output]]);
  }
}

describe("WebMidiXTouchDevice", () => {
  it("connects, decodes input, sends feedback, and disconnects", async () => {
    const access = new TestMidiAccess();
    const device = new WebMidiXTouchDevice({
      requestMidiAccess: async () => access as unknown as MIDIAccess,
    });
    const input = vi.fn();
    device.subscribeInput(input);

    await device.connect();

    expect(device.getSnapshot()).toMatchObject({
      status: "connected",
      deviceName: "X-TOUCH",
      sysexEnabled: true,
    });

    access.input.emit([0x90, 0x5e, 0x7f]);
    expect(input).toHaveBeenCalledWith({
      type: "transport-button",
      button: "play",
      pressed: true,
    });

    device.send([0x90, 0x5e, 0x7f]);
    expect(access.output.messages).toContainEqual([0x90, 0x5e, 0x7f]);

    device.disconnect();
    expect(device.getSnapshot().status).toBe("idle");
    expect(access.input.close).toHaveBeenCalledTimes(1);
    expect(access.output.close).toHaveBeenCalledTimes(1);
  });

  it("keeps port-open failures visible", async () => {
    const access = new TestMidiAccess(
      new TestMidiInput(new Error("port is busy")),
    );
    const device = new WebMidiXTouchDevice({
      requestMidiAccess: async () => access as unknown as MIDIAccess,
    });

    await device.connect();

    expect(device.getSnapshot()).toMatchObject({
      status: "error",
      deviceName: "X-TOUCH",
    });
    expect(device.getSnapshot().error).toContain("port is busy");
    expect(access.input.close).toHaveBeenCalledTimes(1);
    expect(access.output.close).toHaveBeenCalledTimes(1);
  });
});
