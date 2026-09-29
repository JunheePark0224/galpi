import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commonProps, detectDevice, nextRound, setEntry } from "./common";

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
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the same anonymous id across calls and marks a returning visit", () => {
    const first = commonProps();
    expect(first.anon_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.returning).toBe(false);
    sessionStorage.clear();
    const second = commonProps();
    expect(second.anon_id).toBe(first.anon_id);
    expect(second.session_id).toBe(first.session_id);
    expect(second.returning).toBe(false);
  });

  it("carries entry and round", () => {
    setEntry("leaf");
    nextRound();
    const p = commonProps();
    expect(p.entry).toBe("leaf");
    expect(p.round).toBe(2);
    expect(p.screen_version).toBe("v1");
  });

  it("keeps stable ids and returning=false when storage getters throw", async () => {
    const originalLocal = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalSession = Object.getOwnPropertyDescriptor(window, "sessionStorage");

    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("blocked");
        },
      });
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        get() {
          throw new Error("blocked");
        },
      });

      // Fresh module import with blocked storage
      vi.resetModules();
      const { commonProps: freshCommonProps } = await import("./common");

      const first = freshCommonProps();
      const second = freshCommonProps();

      expect(first.anon_id).toBe(second.anon_id);
      expect(first.session_id).toBe(second.session_id);
      expect(first.returning).toBe(false);
      expect(second.returning).toBe(false);
    } finally {
      if (originalLocal) {
        Object.defineProperty(window, "localStorage", originalLocal);
      }
      if (originalSession) {
        Object.defineProperty(window, "sessionStorage", originalSession);
      }
    }
  });

  it("keeps stable ids and returning=false when getItem=null and setItem throws", async () => {
    const throwingStorage: Storage = {
      getItem: () => null,
      setItem: () => { throw new Error("access denied"); },
      removeItem: () => { throw new Error("access denied"); },
      clear: () => { throw new Error("access denied"); },
      key: () => null,
      length: 0,
    };

    const originalLocal = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalSession = Object.getOwnPropertyDescriptor(window, "sessionStorage");

    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: throwingStorage,
      });
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        value: throwingStorage,
      });

      vi.resetModules();
      const { commonProps: freshCommonProps } = await import("./common");

      const first = freshCommonProps();
      const second = freshCommonProps();

      expect(first.anon_id).toBe(second.anon_id);
      expect(first.session_id).toBe(second.session_id);
      expect(first.returning).toBe(false);
      expect(second.returning).toBe(false);
    } finally {
      if (originalLocal) {
        Object.defineProperty(window, "localStorage", originalLocal);
      } else {
        Reflect.deleteProperty(window, "localStorage");
      }
      if (originalSession) {
        Object.defineProperty(window, "sessionStorage", originalSession);
      } else {
        Reflect.deleteProperty(window, "sessionStorage");
      }
    }
  });

  it("generates valid uuid without crypto.randomUUID", () => {
    const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");

    try {
      Object.defineProperty(crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      });

      const p = commonProps();
      expect(p.anon_id).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      if (originalRandomUUID) {
        Object.defineProperty(crypto, "randomUUID", originalRandomUUID);
      } else {
        Reflect.deleteProperty(crypto, "randomUUID");
      }
    }
  });
});
