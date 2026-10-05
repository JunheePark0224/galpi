import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCollection, markCollectionSeen, parseFound, reportMeeting } from "./client";

const ART = { animal: "otter", bg: "peach", sky: "moon", ground: "none", rare: true };
const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("도감 client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a shown bookmark with the ticket and the index, and keeps only parts we collect (never the empty ground)", async () => {
    const fetchMock = answer(200, { ok: true, found: [{ kind: "animal", value: "otter" }, { kind: "animal", value: "dragon" }, { kind: "hat", value: "x" }, null, { kind: "ground", value: "none" }] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await reportMeeting({ seed: 3, count: 5, iat: 100, sub: null, sig: "s" }, 2)).toEqual([{ kind: "animal", value: "otter", tier: "limited" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/collection/found", expect.objectContaining({ method: "POST", body: JSON.stringify({ seed: 3, count: 5, iat: 100, sub: null, sig: "s", index: 2 }) }));
  });

  it("does not ask without a signature, and treats a refusal as nothing new", async () => {
    const fetchMock = answer(403, { error: "bad ticket" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await reportMeeting({ seed: 3, count: 5, iat: 100, sub: null, sig: null }, 0)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await reportMeeting({ seed: 3, count: 5, iat: 100, sub: null, sig: "s" }, 0)).toEqual([]);
    expect(parseFound(null)).toEqual([]);
  });

  it("loads the 도감 rows, checked again, or says login / error", async () => {
    vi.stubGlobal("fetch", answer(200, { items: [
      { kind: "animal", value: "otter", firstMetAt: "2026-10-05T00:00:00Z", firstArt: ART, isNew: true },
      { kind: "animal", value: "otter", firstMetAt: 5, firstArt: ART },
      { kind: "bg", value: "peach", firstMetAt: "2026-10-05T00:00:00Z", firstArt: { animal: "dragon" } },
      { kind: "sky", value: "ufo", firstMetAt: "2026-10-05T00:00:00Z", firstArt: ART },
      { kind: "ground", value: "none", firstMetAt: "2026-10-05T00:00:00Z", firstArt: ART, isNew: true },
    ] }));
    expect(await loadCollection()).toEqual({ status: "ready", items: [{ kind: "animal", value: "otter", firstMetAt: "2026-10-05T00:00:00Z", firstArt: ART, isNew: true }] });
    vi.stubGlobal("fetch", answer(401, { error: "login needed" }));
    expect(await loadCollection()).toEqual({ status: "login" });
    vi.stubGlobal("fetch", answer(503, { error: "collection is not ready" }));
    expect(await loadCollection()).toEqual({ status: "error" });
  });

  it("clears NEW with a POST", async () => {
    const fetchMock = answer(200, { ok: true, seen: 1 });
    vi.stubGlobal("fetch", fetchMock);
    await markCollectionSeen();
    expect(fetchMock).toHaveBeenCalledWith("/api/collection/seen", expect.objectContaining({ method: "POST" }));
  });
});
