import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commonProps, detectDevice, nextRound, setEntry, _resetFallbacks } from "./common";

describe("detectDevice", () => {
  it("detects a phone inside the KakaoTalk in-app browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK 10.8.0";
    expect(detectDevice(ua)).toEqual({ device: "phone", in_app_browser: true });
  });
  it("detects a desktop browser", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
    expect(detectDevice(ua)).toEqual({ device: "desktop", in_app_browser: false });
  });
});

describe("commonProps", () => {
  beforeEach(() => {
    _resetFallbacks();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage may throw if it's mocked
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the same anonymous id across calls and marks a returning visit", () => {
    const first = commonProps();
    expect(first.anon_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.returning).toBe(false);
    sessionStorage.clear();                      // new session, same browser
    const second = commonProps();
    expect(second.anon_id).toBe(first.anon_id);
    expect(second.returning).toBe(true);
  });

  it("carries entry and round", () => {
    setEntry("leaf");
    nextRound();
    const p = commonProps();
    expect(p.entry).toBe("leaf");
    expect(p.round).toBe(2);
    expect(p.screen_version).toBe("v1");
  });

  it("keeps stable ids when storage throws", () => {
    const throwingStorage: Storage = {
      getItem: () => { throw new Error("access denied"); },
      setItem: () => { throw new Error("access denied"); },
      removeItem: () => { throw new Error("access denied"); },
      clear: () => { throw new Error("access denied"); },
      key: () => null,
      length: 0,
    };
    const originalLocal = window.localStorage;
    const originalSession = window.sessionStorage;

    Object.defineProperty(window, "localStorage", {
      value: throwingStorage,
      configurable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      value: throwingStorage,
      configurable: true,
    });

    const first = commonProps();
    const second = commonProps();
    expect(first.anon_id).toBe(second.anon_id);

    Object.defineProperty(window, "localStorage", {
      value: originalLocal,
      configurable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      value: originalSession,
      configurable: true,
    });
  });

  it("generates valid uuid without crypto.randomUUID", () => {
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });

    expect(() => {
      const p = commonProps();
      expect(p.anon_id).toMatch(/^[0-9a-f-]{36}$/);
    }).not.toThrow();

    Object.defineProperty(crypto, "randomUUID", {
      value: originalRandomUUID,
      configurable: true,
    });
  });
});
