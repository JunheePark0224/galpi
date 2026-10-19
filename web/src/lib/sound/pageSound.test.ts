import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetSoundForTests, isSoundOn, playPage, setSoundOn, SOUND_OFF_KEY, subscribeSound } from "./pageSound";

/** A Web Audio stand-in: enough nodes for the synth, and a count of what was started. */
function fakeAudio() {
  const started: string[] = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = (kind: string) => ({
    connect: vi.fn().mockImplementation(function (this: unknown, next: unknown) { return next; }),
    start: vi.fn(() => started.push(kind)), stop: vi.fn(),
    gain: param(), frequency: param(), Q: param(), type: "", buffer: null,
  });
  const ctx = {
    state: "running", currentTime: 0, sampleRate: 8000, destination: {},
    resume: vi.fn(function (this: { state: string }) { this.state = "running"; return Promise.resolve(); }),
    createBuffer: vi.fn((_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
    createBufferSource: vi.fn(() => node("noise")),
    createOscillator: vi.fn(() => node("tone")),
    createBiquadFilter: vi.fn(() => node("filter")),
    createGain: vi.fn(() => node("gain")),
  };
  const Ctor = vi.fn(function () { return ctx; });
  vi.stubGlobal("AudioContext", Ctor);
  return { Ctor, ctx, started };
}

describe("page sounds (PRD F-29, DESIGN C-34)", () => {
  beforeEach(() => { localStorage.clear(); forgetSoundForTests(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("is on by default and makes no audio context until the first sound (a tap)", () => {
    const { Ctor } = fakeAudio();
    expect(isSoundOn()).toBe(true);
    expect(Ctor).not.toHaveBeenCalled();
    playPage("flip");
    expect(Ctor).toHaveBeenCalledTimes(1);
    playPage("open");
    expect(Ctor).toHaveBeenCalledTimes(1);   // one context for the page
  });

  it("the page turn (넘김 2) is paper noise only; opening (펼침 A) adds the low thump", () => {
    const { started } = fakeAudio();
    playPage("flip");
    expect(started.length).toBeGreaterThan(0);
    expect(started.every((k) => k === "noise")).toBe(true);
    started.length = 0;
    playPage("open");
    expect(started).toContain("tone");
    expect(started).toContain("noise");
  });

  it.each(["suspended", "interrupted"])("wakes a %s context and sounds only once it runs", async (state) => {
    const { ctx, started } = fakeAudio();
    ctx.state = state;
    playPage("flip");
    expect(ctx.resume).toHaveBeenCalled();
    expect(started).toEqual([]);                 // nothing scheduled on a stopped clock
    await Promise.resolve(); await Promise.resolve();
    expect(started.length).toBeGreaterThan(0);
  });

  it("stays silent when the context cannot wake (no pile-up later)", async () => {
    const { ctx, started } = fakeAudio();
    ctx.state = "suspended";
    ctx.resume.mockImplementation(() => Promise.reject(new Error("not allowed")));
    playPage("flip");
    await Promise.resolve(); await Promise.resolve();
    expect(started).toEqual([]);
  });

  it("makes the noise once and reuses it", () => {
    const { ctx } = fakeAudio();
    playPage("flip");
    playPage("flip");
    playPage("open");
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1);
  });

  it("stays silent when turned off, remembers it in this browser, and tells subscribers", () => {
    const { Ctor } = fakeAudio();
    const heard = vi.fn();
    const stop = subscribeSound(heard);
    setSoundOn(false);
    expect(isSoundOn()).toBe(false);
    expect(localStorage.getItem(SOUND_OFF_KEY)).toBe("1");
    expect(heard).toHaveBeenCalledTimes(1);
    playPage("flip");
    expect(Ctor).not.toHaveBeenCalled();
    setSoundOn(true);
    expect(localStorage.getItem(SOUND_OFF_KEY)).toBeNull();
    stop();
  });

  it("without Web Audio, or when it throws, nothing breaks", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => playPage("flip")).not.toThrow();
    vi.stubGlobal("AudioContext", vi.fn(() => { throw new Error("no audio"); }));
    expect(() => playPage("open")).not.toThrow();
  });

  it("with storage blocked: on by default, and turning it off still holds for this page", () => {
    fakeAudio();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(isSoundOn()).toBe(true);
    setSoundOn(false);
    expect(isSoundOn()).toBe(false);
  });
});
