import { beforeEach, describe, expect, it } from "vitest";
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
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

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
});
