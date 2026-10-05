import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commonProps, detectDevice, nextRound, setEntry, setMode } from "./common";

describe("detectDevice", () => {
  // taxonomy v1.4: the launch channels' in-app browsers (UA shapes as those apps send them)
  it.each([
    ["Instagram iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.24.89 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 634108168)"],
    ["Instagram Android", "Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 345.0.0.48.95 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911N; dm1q; qcom; ko_KR; 634108168)"],
    ["Threads iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 352.0.0.20.80 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 645204331)"],
    ["Threads Android", "Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Barcelona 352.0.0.20.80 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911N; dm1q; qcom; ko_KR; 645204331)"],
    ["KakaoTalk iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5"],
    ["LinkedIn iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234"],
    ["LinkedIn Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [LinkedInApp]/4.1.1010"],
  ])("detects a phone inside the %s in-app browser", (_, ua) => {
    expect(detectDevice(ua)).toEqual({ device: "phone", is_in_app_browser: true });
  });
  it.each([
    ["mobile Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
    ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36"],
  ])("does not flag %s as in-app", (_, ua) => {
    expect(detectDevice(ua)).toEqual({ device: "phone", is_in_app_browser: false });
  });
  it("detects a phone inside the KakaoTalk in-app browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK 10.8.0";
    expect(detectDevice(ua)).toEqual({ device: "phone", is_in_app_browser: true });
  });
  it("detects a desktop browser", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
    expect(detectDevice(ua)).toEqual({ device: "desktop", is_in_app_browser: false });
  });
});

describe("commonProps", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the same anonymous id within a page load", () => {
    const first = commonProps();
    expect(first.anon_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.is_returning).toBe(false);
    sessionStorage.clear();
    const second = commonProps();
    expect(second.anon_id).toBe(first.anon_id);
    expect(second.session_id).toBe(first.session_id);
    expect(second.is_returning).toBe(false);
  });

  it("sends only the host of document.referrer, never its path or search words (taxonomy v1.4)", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://search.example/?q=" + "가".repeat(900));
    expect(commonProps().referrer).toBe("search.example");
    vi.spyOn(document, "referrer", "get").mockReturnValue("");
    expect(commonProps().referrer).toBe("");
  });

  it("carries entry and round", () => {
    setEntry("leaf");
    nextRound();
    const p = commonProps();
    expect(p.entry).toBe("leaf");
    expect(p.round).toBe(2);
    expect(p.screen_version).toBe("v2");
  });

  it("carries the route (mode) and clears it back to null (taxonomy v1.0)", () => {
    setMode("challenge");
    expect(commonProps().mode).toBe("challenge");
    setMode(null);
    expect(commonProps().mode).toBeNull();
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
      expect(first.is_returning).toBe(false);
      expect(second.is_returning).toBe(false);
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
      expect(first.is_returning).toBe(false);
      expect(second.is_returning).toBe(false);
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

  it("generates valid uuid fallback when crypto.randomUUID unavailable", async () => {
    localStorage.clear();
    sessionStorage.clear();
    const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");

    try {
      Object.defineProperty(crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      });

      vi.resetModules();
      const { commonProps: freshCommonProps } = await import("./common");

      const spy = vi.spyOn(Math, "random");
      const p = freshCommonProps();

      // RFC4122-v4 pattern: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
      expect(p.anon_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(spy).toHaveBeenCalled();
    } finally {
      if (originalRandomUUID) {
        Object.defineProperty(crypto, "randomUUID", originalRandomUUID);
      } else {
        Reflect.deleteProperty(crypto, "randomUUID");
      }
    }
  });

  it("marks a returning visit with returning=true on fresh page load", async () => {
    // First page load: create anon_id and store in localStorage
    const firstPageLoad = commonProps();
    const storedAnonId = firstPageLoad.anon_id;
    expect(firstPageLoad.is_returning).toBe(false);

    // New page load: localStorage persists, sessionStorage cleared, memory empty
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("galpi.anon", storedAnonId);
    localStorage.setItem("galpi.seen", "1");

    const { commonProps: freshCommonProps } = await import("./common");
    const secondPageLoad = freshCommonProps();

    expect(secondPageLoad.anon_id).toBe(storedAnonId);
    expect(secondPageLoad.is_returning).toBe(true);
  });
});

describe("commonProps returning is fixed per session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("is true on every call of a returning session", async () => {
    localStorage.setItem("galpi.anon", "11111111-1111-4111-8111-111111111111");
    localStorage.setItem("galpi.seen", "1");
    const { commonProps: fresh } = await import("./common");
    const first = fresh();
    const second = fresh();
    expect(first.is_returning).toBe(true);
    expect(second.is_returning).toBe(true);
    expect(second.session_id).toBe(first.session_id);
  });

  it("stays true after a module reload within the same session", async () => {
    localStorage.setItem("galpi.anon", "11111111-1111-4111-8111-111111111111");
    localStorage.setItem("galpi.seen", "1");
    const a = await import("./common");
    expect(a.commonProps().is_returning).toBe(true);
    vi.resetModules();
    const b = await import("./common");
    expect(b.commonProps().is_returning).toBe(true);
  });

  it("stays false on every call of a first-ever visit", async () => {
    const { commonProps: fresh } = await import("./common");
    expect(fresh().is_returning).toBe(false);
    expect(fresh().is_returning).toBe(false);
  });
});

describe("entry and round survive a reload in the same tab session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("reads entry and round back after the module is loaded again", async () => {
    const before = await import("./common");
    before.setEntry("target");
    before.nextRound();
    vi.resetModules();
    const after = await import("./common");
    const p = after.commonProps();
    expect(p.entry).toBe("target");
    expect(p.round).toBe(2);
  });

  it("clears entry back to null", async () => {
    const m = await import("./common");
    m.setEntry("leaf");
    m.setEntry(null);
    expect(m.commonProps().entry).toBeNull();
  });

  it("starts at round 1 with no entry in a new session", async () => {
    const m = await import("./common");
    const p = m.commonProps();
    expect(p.round).toBe(1);
    expect(p.entry).toBeNull();
  });
});

describe("readAnonId (read-only, for the privacy page)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("returns the stored anonymous id", async () => {
    localStorage.setItem("galpi.anon", "11111111-1111-4111-8111-111111111111");
    const { readAnonId } = await import("./common");
    expect(readAnonId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns null and creates nothing when no id exists", async () => {
    const { readAnonId, commonProps: fresh } = await import("./common");
    expect(readAnonId()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    // the read must not leave an id in memory either: the first real id is created later, by commonProps
    expect(readAnonId()).toBeNull();
    const created = fresh().anon_id;
    expect(readAnonId()).toBe(created);
  });

  it("returns null when storage access throws", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    try {
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
      const { readAnonId } = await import("./common");
      expect(readAnonId()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("ensureAnonId (used as the Amplitude device id)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("returns the stored id without changing it", async () => {
    localStorage.setItem("galpi.anon", "11111111-1111-4111-8111-111111111111");
    const { ensureAnonId } = await import("./common");
    expect(ensureAnonId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(localStorage.getItem("galpi.anon")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("creates and stores an id when none exists, and commonProps then uses the same one", async () => {
    const { ensureAnonId, commonProps: fresh } = await import("./common");
    const id = ensureAnonId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem("galpi.anon")).toBe(id);
    expect(ensureAnonId()).toBe(id);
    expect(fresh().anon_id).toBe(id);
  });

  it("does not start a session or mark the browser as seen (only commonProps does)", async () => {
    const { ensureAnonId } = await import("./common");
    ensureAnonId();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("galpi.seen")).toBeNull();
  });
});

describe("campaignAtLanding (taxonomy v1.4 — first touch, kept for the session like the session id)", () => {
  /** A fresh module = a fresh page load (the in-memory fallback starts empty, as in a real new document). */
  const pageLoad = async () => { vi.resetModules(); return (await import("./common")).campaignAtLanding; };
  beforeEach(() => sessionStorage.clear());
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("reads the landing address once and keeps it for the session, even after the address changes or a reload", async () => {
    window.history.replaceState(null, "", "/?utm_source=Threads&utm_medium=social&utm_campaign=launch_1007");
    const campaignAtLanding = await pageLoad();
    const first = campaignAtLanding();
    expect(first).toEqual({ utm_source: "threads", utm_medium: "social", utm_campaign: "launch_1007" });
    window.history.replaceState(null, "", "/?utm_source=instagram");
    expect(campaignAtLanding()).toEqual(first);
    expect(await pageLoad().then((read) => read())).toEqual(first);   // reload in the same tab
    expect(JSON.parse(sessionStorage.getItem("galpi.campaign") ?? "{}")).toEqual(first);
  });

  it("an untagged first load is the session's answer too: a later tagged address does not replace it", async () => {
    const read = await pageLoad();
    window.history.replaceState(null, "", "/");
    expect(read()).toEqual({ utm_source: null, utm_medium: null, utm_campaign: null });
    window.history.replaceState(null, "", "/?utm_source=linkedin");
    expect(read().utm_source).toBeNull();
    expect((await pageLoad())().utm_source).toBeNull();
  });

  it("a new session (tab) reads its own landing address", async () => {
    window.history.replaceState(null, "", "/?utm_source=linkedin&utm_medium=social");
    expect((await pageLoad())().utm_source).toBe("linkedin");
    sessionStorage.clear();
    window.history.replaceState(null, "", "/?utm_source=instagram");
    expect((await pageLoad())()).toEqual({ utm_source: "instagram", utm_medium: null, utm_campaign: null });
  });
});
