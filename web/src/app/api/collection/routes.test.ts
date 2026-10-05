// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artsForDraw, collectibleParts, tierOf } from "@/lib/art/combine";
import { isbnsOf } from "@/lib/collection/__fixtures__/isbns";
import { memoryCollection } from "@/lib/collection/__fixtures__/memoryStore";
import { CollectionUnavailable, type CollectionStore } from "@/lib/collection/types";
import { memoryStore } from "@/lib/library/__fixtures__/memoryStore";

vi.mock("server-only", () => ({}));
let configured = true;
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
let userId: string | null = U1;
let writable = true;
let store: ReturnType<typeof memoryCollection>;
let storeU2: ReturnType<typeof memoryCollection>;
let claimsMissing = false;
let broken: Error | null = null;
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => (configured ? {} : null),
  sessionUserId: async () => userId,
}));
vi.mock("@/lib/collection/supabaseStore", () => ({
  collectionWriter: () => (writable ? {} : null),
  supabaseCollection: (_reader: unknown, _writer: unknown, uid: string): CollectionStore => {
    if (broken) {
      const fail = async () => { throw broken; };
      return { items: fail, record: fail, markSeen: fail, claimKept: fail };
    }
    const mine = uid === U2 ? storeU2 : store;
    return claimsMissing ? { ...mine, claimKept: async () => { throw new CollectionUnavailable(); } } : mine;
  },
}));
let saves: ReturnType<typeof memoryStore>;
let savesBroken = false;
vi.mock("@/lib/library/supabaseStore", () => ({
  supabaseStore: () => (savesBroken ? { ...saves, saves: async () => { throw new Error("db down"); } } : saves),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { issueTicket, nowSeconds, TICKET_TTL_SECONDS } from "@/lib/collection/ticket";
import { GET as list } from "./route";
import { POST as found } from "./found/route";
import { POST as seen } from "./seen/route";

const ORIGIN = "http://x";
let ip = 0;
const headers = () => ({ origin: ORIGIN, "x-forwarded-for": `10.1.0.${ip++ % 250}` });
const get = (path: string) => new Request(`${ORIGIN}${path}`, { headers: headers() });
const post = (path: string, body?: unknown) => new Request(`${ORIGIN}${path}`, {
  method: "POST", headers: { ...headers(), "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("도감 routes", () => {
  beforeEach(() => {
    const claims = new Map<string, string>();
    store = memoryCollection([], undefined, { userId: U1, claims });
    storeU2 = memoryCollection([], undefined, { userId: U2, claims });
    saves = memoryStore();
  });
  afterEach(() => {
    configured = true; userId = U1; writable = true; broken = null; savesBroken = false; claimsMissing = false;
    vi.unstubAllEnvs(); vi.clearAllMocks();
  });

  it("records the shown bookmark's collectible parts, worked out from the signed seed, and says which were new", async () => {
    const ticket = issueTicket(isbnsOf(5), { seed: 1234, sub: U1 });
    const res = await found(post("/api/collection/found", { ...ticket, index: 2 }));
    expect(res.status).toBe(200);
    const art = artsForDraw(5, 1234)[2];
    const body = await res.json();
    expect(body.found).toEqual(collectibleParts(art).map((p) => ({ ...p, tier: tierOf(p.kind, p.value) })));
    expect(store.data.items.map((i) => i.firstArt)).toEqual(collectibleParts(art).map(() => art));
    // the same bookmark again: nothing new, first meeting kept
    expect((await (await found(post("/api/collection/found", { ...ticket, index: 2 }))).json()).found).toEqual([]);
    expect(store.data.items).toHaveLength(collectibleParts(art).length);
  });

  it("rejects a tampered seed, count or index (403) and a malformed body (400) — before asking who is logged in", async () => {
    userId = null;
    const ticket = issueTicket(isbnsOf(5), { seed: 77, sub: U1 });
    expect((await found(post("/api/collection/found", { ...ticket, seed: 78, index: 0 }))).status).toBe(403);
    expect((await found(post("/api/collection/found", { ...ticket, count: 6, isbns: isbnsOf(6), index: 5 }))).status).toBe(403);
    expect((await found(post("/api/collection/found", { ...ticket, isbns: isbnsOf(5, 1), index: 0 }))).status).toBe(403);   // other books
    expect((await found(post("/api/collection/found", { ...ticket, sig: "A".repeat(43), index: 0 }))).status).toBe(403);
    for (const bad of [{ ...ticket, index: 5 }, { ...ticket, index: -1 }, { ...ticket, sig: "short", index: 0 }, { ...ticket, seed: 2 ** 32, index: 0 },
      { ...ticket, isbns: undefined, index: 0 }, { ...ticket, count: 6, index: 0 }, [], "x"]) {
      expect((await found(post("/api/collection/found", bad))).status, JSON.stringify(bad)).toBe(400);
    }
    expect(store.data.items).toHaveLength(0);
    // a good ticket from someone logged out: 401, nothing recorded
    expect((await found(post("/api/collection/found", { ...ticket, index: 0 }))).status).toBe(401);
    expect(store.data.items).toHaveLength(0);
  });

  it("fails closed in production without the secret (503), and needs the login config and the server's write key", async () => {
    const ticket = issueTicket(isbnsOf(5), { seed: 9, sub: U1 });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "");
    expect((await found(post("/api/collection/found", { ...ticket, index: 0 }))).status).toBe(503);
    vi.unstubAllEnvs();
    configured = false;
    expect((await found(post("/api/collection/found", { ...ticket, index: 0 }))).status).toBe(503);
    configured = true;
    writable = false;
    expect((await found(post("/api/collection/found", { ...ticket, index: 0 }))).status).toBe(503);
    expect(store.data.items).toHaveLength(0);
  });

  it("checks a production ticket against the production secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "a-real-secret-for-the-test-at-least-32-chars");
    const ticket = issueTicket(isbnsOf(5), { seed: 31, sub: U1 });
    expect((await found(post("/api/collection/found", { ...ticket, index: 4 }))).status).toBe(200);
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "another-secret-that-is-also-32-chars-long");
    expect((await found(post("/api/collection/found", { ...ticket, index: 4 }))).status).toBe(403);
  });

  it("refuses other sites", async () => {
    const ticket = issueTicket(isbnsOf(5), { seed: 1, sub: U1 });
    const cross = new Request(`${ORIGIN}/api/collection/found`, { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ ...ticket, index: 0 }) });
    expect((await found(cross)).status).toBe(403);
    expect((await list(new Request(`${ORIGIN}/api/collection`, { headers: { origin: "https://evil.example" } }))).status).toBe(403);
  });

  it("lists the person's parts, and NEW goes once the 도감 was seen", async () => {
    await found(post("/api/collection/found", { ...issueTicket(isbnsOf(5), { seed: 3, sub: U1 }), index: 0 }));
    const parts = collectibleParts(artsForDraw(5, 3)[0]).length;
    const first = await (await list(get("/api/collection"))).json();
    expect(first.items).toHaveLength(parts);
    expect(first.items.every((i: { isNew: boolean }) => i.isNew)).toBe(true);
    expect(await (await seen(post("/api/collection/seen"))).json()).toEqual({ ok: true, seen: parts });
    const after = await (await list(get("/api/collection"))).json();
    expect(after.items.some((i: { isNew: boolean }) => i.isNew)).toBe(false);
  });

  it("needs a login to list or clear NEW", async () => {
    userId = null;
    expect((await list(get("/api/collection"))).status).toBe(401);
    expect((await seen(post("/api/collection/seen"))).status).toBe(401);
    writable = false;
    userId = U1;
    expect((await seen(post("/api/collection/seen"))).status).toBe(503);
  });

  it("answers 503 while the table is missing and a plain 500 on other database errors (code only in the log)", async () => {
    broken = new CollectionUnavailable();
    expect((await list(get("/api/collection"))).status).toBe(503);
    expect((await found(post("/api/collection/found", { ...issueTicket(isbnsOf(5), { seed: 3, sub: U1 }), index: 0 }))).status).toBe(503);
    broken = new Error("collection read failed: 08006");
    expect((await list(get("/api/collection"))).status).toBe(500);
    expect(error).toHaveBeenCalledWith("collection:", "collection read failed: 08006");
    broken = null;
  });

  describe("security fix round: tickets expire, are bound to the person, v1 is gone", () => {
    const DEV = "galpi-dev-only-collection-secret-not-for-production";

    it("accepts a ticket up to 2 hours old and refuses an older one or one from the future (403)", async () => {
      const fresh = issueTicket(isbnsOf(5), { seed: 50, sub: U1, iat: nowSeconds() - TICKET_TTL_SECONDS + 60 });
      expect((await found(post("/api/collection/found", { ...fresh, index: 0 }))).status).toBe(200);
      const old = issueTicket(isbnsOf(5), { seed: 51, sub: U1, iat: nowSeconds() - TICKET_TTL_SECONDS - 60 });
      expect((await found(post("/api/collection/found", { ...old, index: 0 }))).status).toBe(403);
      const future = issueTicket(isbnsOf(5), { seed: 52, sub: U1, iat: nowSeconds() + 3600 });
      expect((await found(post("/api/collection/found", { ...future, index: 0 }))).status).toBe(403);
      expect(store.data.items).toHaveLength(collectibleParts(artsForDraw(5, 50)[0]).length);
    });

    it("refuses a ticket whose iat or sub was changed (403) or is malformed (400)", async () => {
      const t = issueTicket(isbnsOf(5), { seed: 60, sub: U1 });
      expect((await found(post("/api/collection/found", { ...t, iat: t.iat + 1, index: 0 }))).status).toBe(403);
      expect((await found(post("/api/collection/found", { ...t, sub: U2, index: 0 }))).status).toBe(403);
      expect((await found(post("/api/collection/found", { ...t, sub: null, index: 0 }))).status).toBe(403);
      expect((await found(post("/api/collection/found", { ...t, iat: "1", index: 0 }))).status).toBe(400);
      expect((await found(post("/api/collection/found", { ...t, sub: "u1", index: 0 }))).status).toBe(400);
      expect(store.data.items).toHaveLength(0);
    });

    it("refuses another person's ticket (403), takes the person's own", async () => {
      const theirs = issueTicket(isbnsOf(5), { seed: 70, sub: U2 });
      expect((await found(post("/api/collection/found", { ...theirs, index: 0 }))).status).toBe(403);
      expect(store.data.items).toHaveLength(0);
      expect((await found(post("/api/collection/found", { ...issueTicket(isbnsOf(5), { seed: 70, sub: U1 }), index: 0 }))).status).toBe(200);
    });

    it("a draw started logged out and seen after logging in: recorded for the first person to claim each bookmark, once", async () => {
      const open = issueTicket(isbnsOf(5), { seed: 71, sub: null });
      expect((await found(post("/api/collection/found", { ...open, index: 0 }))).status).toBe(200);
      expect(store.data.items.length).toBeGreaterThan(0);
      expect((await found(post("/api/collection/found", { ...open, index: 0 }))).status).toBe(200);     // the same person again
      userId = U2;
      const refused = await found(post("/api/collection/found", { ...open, index: 0 }));             // someone else: nothing
      expect(refused.status).toBe(403);
      expect(await refused.json()).toEqual({ error: "not recorded" });
      expect(storeU2.data.items).toHaveLength(0);
      expect((await found(post("/api/collection/found", { ...open, index: 1 }))).status).toBe(200);     // another bookmark is free
      // still only for 2 hours on this path
      const old = issueTicket(isbnsOf(5), { seed: 72, sub: null, iat: nowSeconds() - TICKET_TTL_SECONDS - 60 });
      expect((await found(post("/api/collection/found", { ...old, index: 0 }))).status).toBe(403);
    });

    it("records nothing for a logged-out draw while the claims table (0007) is missing (503), the person's own draws still work", async () => {
      claimsMissing = true;
      expect((await found(post("/api/collection/found", { ...issueTicket(isbnsOf(5), { seed: 73, sub: null }), index: 0 }))).status).toBe(503);
      expect(store.data.items).toHaveLength(0);
      expect((await found(post("/api/collection/found", { ...issueTicket(isbnsOf(5), { seed: 73, sub: U1 }), index: 0 }))).status).toBe(200);
    });

    it("no longer accepts a v2 ticket (signed without the draw's books)", async () => {
      const iat = nowSeconds();
      const v2 = createHmac("sha256", DEV).update(`galpi-art:v2:81:5:${iat}:${U1}`).digest("base64url");
      expect((await found(post("/api/collection/found", { seed: 81, count: 5, iat, sub: U1, sig: v2, index: 0 }))).status).toBe(400);
      expect((await found(post("/api/collection/found", { seed: 81, count: 5, iat, sub: U1, sig: v2, isbns: isbnsOf(5), index: 0 }))).status).toBe(403);
    });

    it("no longer accepts a v1 ticket (seed and count signed alone)", async () => {
      const v1 = createHmac("sha256", DEV).update("galpi-art:v1:80:5").digest("base64url");
      expect((await found(post("/api/collection/found", { seed: 80, count: 5, sig: v1, index: 0 }))).status).toBe(400);
      expect((await found(post("/api/collection/found", { seed: 80, count: 5, iat: nowSeconds(), sub: null, sig: v1, isbns: isbnsOf(5), index: 0 }))).status).toBe(403);
    });
  });

  describe("kept (v1.7): a bookmark saved before logging in, reported when it reached the account", () => {
    const ISBN = "9788998441012";
    const OTHER = "9788937460449";
    const DRAW = [OTHER, ISBN, ...isbnsOf(3)];                                     // the draw's books; ISBN is bookmark 1
    const SEED = 4321;
    const ART = artsForDraw(5, SEED)[1];
    const keep = (art = ART, isbn = ISBN) => {
      saves.data.saves = [...saves.data.saves, { isbn, art, originalArt: art, reason: { label: "나온 이유", items: [] }, metOn: "2026-10-05", shelfId: "s", position: 0 }];
    };
    const ticket = (opts: { sub?: string | null; iat?: number } = {}) => issueTicket(DRAW, { seed: SEED, ...opts });
    const kept = (t: ReturnType<typeof issueTicket>, extra: Record<string, unknown> = {}) =>
      post("/api/collection/found", { ...t, index: 1, isbn: ISBN, kept: true, ...extra });

    it("records the parts of the person's own saved bookmark from a logged-out draw — of any age (a login a month later loses nothing)", async () => {
      keep();
      const res = await found(kept(ticket({ iat: nowSeconds() - 60 * 24 * 60 * 60 })));
      expect(res.status).toBe(200);
      expect((await res.json()).found).toEqual(collectibleParts(ART).map((p) => ({ ...p, tier: tierOf(p.kind, p.value) })));
    });

    it("a decorated bookmark still counts: its first picture is compared", async () => {
      keep();
      saves.data.saves = saves.data.saves.map((r) => ({ ...r, art: { ...ART, animal: ART.animal === "fox" ? "owl" : "fox" } }));
      expect((await found(kept(ticket()))).status).toBe(200);
    });

    it("one person per bookmark: a shared ticket claimed by someone else is refused like any other (no oracle); the same person again is fine", async () => {
      keep();
      expect((await found(kept(ticket()))).status).toBe(200);
      expect((await found(kept(ticket()))).status).toBe(200);                   // a retry by the same person
      userId = U2;                                                              // another account saved the same book, same art
      const claimed = await found(kept(ticket()));
      saves.data.saves = [];
      const notSaved = await found(kept(ticket()));
      expect([claimed.status, await claimed.json()]).toEqual([403, { error: "not recorded" }]);
      expect([notSaved.status, await notSaved.json()]).toEqual([403, { error: "not recorded" }]);
      expect(storeU2.data.items).toHaveLength(0);
    });

    it("refuses a logged-in draw, a book that is not that bookmark's, a book not saved, another picture, a bad isbn", async () => {
      keep();
      keep(ART, OTHER);
      expect((await found(kept(ticket({ sub: U1 })))).status).toBe(403);
      expect((await found(kept(ticket(), { isbn: OTHER }))).status).toBe(403);   // OTHER is bookmark 0 of the draw, not 1
      expect((await found(kept(ticket(), { isbn: "9788932917245" }))).status).toBe(403);   // not in the draw at all
      saves.data.saves = saves.data.saves.filter((r) => r.isbn !== ISBN);
      expect((await found(kept(ticket()))).status).toBe(403);                   // that book is not saved
      keep(artsForDraw(5, SEED)[2]);
      expect((await found(kept(ticket()))).status).toBe(403);                   // saved with another picture
      expect((await found(kept(ticket(), { isbn: "123" }))).status).toBe(400);
      expect((await found(kept(ticket(), { isbn: undefined }))).status).toBe(400);
      expect(store.data.items).toHaveLength(0);
    });

    it("a ticket older than 2 hours on the plain path stays refused (that path is unchanged)", async () => {
      keep();
      const old = ticket({ iat: nowSeconds() - TICKET_TTL_SECONDS - 60 });
      expect((await found(post("/api/collection/found", { ...old, index: 1 }))).status).toBe(403);
      expect((await found(kept(old))).status).toBe(200);
    });

    it("needs a login; 500 when the bookmarks cannot be read; 503 while the claims table (0007) is missing", async () => {
      keep();
      userId = null;
      expect((await found(kept(ticket()))).status).toBe(401);
      userId = U1;
      savesBroken = true;
      expect((await found(kept(ticket()))).status).toBe(500);
      savesBroken = false;
      claimsMissing = true;
      expect((await found(kept(ticket()))).status).toBe(503);
      expect(store.data.items).toHaveLength(0);
    });
  });
});
