import { afterEach, describe, expect, it, vi } from "vitest";
import { libraryRequest } from "./client";

const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => body });

describe("libraryRequest (browser → 내 책갈피 routes)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON to our route and returns the answer", async () => {
    const f = reply(200, { ok: true, saved: true });
    vi.stubGlobal("fetch", f);
    expect(await libraryRequest("POST", "/api/library/saves", { isbn: "1" })).toEqual({ ok: true, status: 200, body: { ok: true, saved: true } });
    expect(f).toHaveBeenCalledWith("/api/library/saves", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ isbn: "1" }), credentials: "same-origin", cache: "no-store",
    });
  });

  it("returns the status of a refusal, and status 0 when offline", async () => {
    vi.stubGlobal("fetch", reply(401, { error: "login needed" }));
    expect(await libraryRequest("GET", "/api/library")).toEqual({ ok: false, status: 401, body: { error: "login needed" } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await libraryRequest("GET", "/api/library")).toEqual({ ok: false, status: 0, body: null });
  });
});
