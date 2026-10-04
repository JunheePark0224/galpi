// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artsForDraw, partsOf, tierOf } from "@/lib/art/combine";
import { memoryCollection } from "@/lib/collection/__fixtures__/memoryStore";
import { CollectionUnavailable, type CollectionStore } from "@/lib/collection/types";

vi.mock("server-only", () => ({}));
let configured = true;
let userId: string | null = "u1";
let writable = true;
let store: ReturnType<typeof memoryCollection>;
let broken: Error | null = null;
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => (configured ? {} : null),
  sessionUserId: async () => userId,
}));
vi.mock("@/lib/collection/supabaseStore", () => ({
  collectionWriter: () => (writable ? {} : null),
  supabaseCollection: (): CollectionStore => (broken
    ? { items: async () => { throw broken; }, record: async () => { throw broken; }, markSeen: async () => { throw broken; } }
    : store),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { issueTicket } from "@/lib/collection/ticket";
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
  beforeEach(() => { store = memoryCollection(); });
  afterEach(() => { configured = true; userId = "u1"; writable = true; broken = null; vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("records the shown bookmark's four parts, worked out from the signed seed, and says which were new", async () => {
    const ticket = issueTicket(5, 1234);
    const res = await found(post("/api/collection/found", { ...ticket, index: 2 }));
    expect(res.status).toBe(200);
    const art = artsForDraw(5, 1234)[2];
    const body = await res.json();
    expect(body.found).toEqual(partsOf(art).map((p) => ({ ...p, tier: tierOf(p.kind, p.value) })));
    expect(store.data.items.map((i) => i.firstArt)).toEqual([art, art, art, art]);
    // the same bookmark again: nothing new, first meeting kept
    expect((await (await found(post("/api/collection/found", { ...ticket, index: 2 }))).json()).found).toEqual([]);
    expect(store.data.items).toHaveLength(4);
  });

  it("rejects a tampered seed, count or index (403) and a malformed body (400) — before asking who is logged in", async () => {
    userId = null;
    const ticket = issueTicket(5, 77);
    expect((await found(post("/api/collection/found", { ...ticket, seed: 78, index: 0 }))).status).toBe(403);
    expect((await found(post("/api/collection/found", { ...ticket, count: 6, index: 5 }))).status).toBe(403);
    expect((await found(post("/api/collection/found", { ...ticket, sig: "A".repeat(43), index: 0 }))).status).toBe(403);
    for (const bad of [{ ...ticket, index: 5 }, { ...ticket, index: -1 }, { ...ticket, sig: "short", index: 0 }, { ...ticket, seed: 2 ** 32, index: 0 }, [], "x"]) {
      expect((await found(post("/api/collection/found", bad))).status, JSON.stringify(bad)).toBe(400);
    }
    expect(store.data.items).toHaveLength(0);
    // a good ticket from someone logged out: 401, nothing recorded
    expect((await found(post("/api/collection/found", { ...ticket, index: 0 }))).status).toBe(401);
    expect(store.data.items).toHaveLength(0);
  });

  it("fails closed in production without the secret (503), and needs the login config and the server's write key", async () => {
    const ticket = issueTicket(5, 9);
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
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "a-real-secret-for-the-test");
    const ticket = issueTicket(5, 31);
    expect((await found(post("/api/collection/found", { ...ticket, index: 4 }))).status).toBe(200);
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "another-secret");
    expect((await found(post("/api/collection/found", { ...ticket, index: 4 }))).status).toBe(403);
  });

  it("refuses other sites", async () => {
    const ticket = issueTicket(5, 1);
    const cross = new Request(`${ORIGIN}/api/collection/found`, { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ ...ticket, index: 0 }) });
    expect((await found(cross)).status).toBe(403);
    expect((await list(new Request(`${ORIGIN}/api/collection`, { headers: { origin: "https://evil.example" } }))).status).toBe(403);
  });

  it("lists the person's parts, and NEW goes once the 도감 was seen", async () => {
    await found(post("/api/collection/found", { ...issueTicket(5, 3), index: 0 }));
    const first = await (await list(get("/api/collection"))).json();
    expect(first.items).toHaveLength(4);
    expect(first.items.every((i: { isNew: boolean }) => i.isNew)).toBe(true);
    expect(await (await seen(post("/api/collection/seen"))).json()).toEqual({ ok: true, seen: 4 });
    const after = await (await list(get("/api/collection"))).json();
    expect(after.items.some((i: { isNew: boolean }) => i.isNew)).toBe(false);
  });

  it("needs a login to list or clear NEW", async () => {
    userId = null;
    expect((await list(get("/api/collection"))).status).toBe(401);
    expect((await seen(post("/api/collection/seen"))).status).toBe(401);
    writable = false;
    userId = "u1";
    expect((await seen(post("/api/collection/seen"))).status).toBe(503);
  });

  it("answers 503 while the table is missing and a plain 500 on other database errors (code only in the log)", async () => {
    broken = new CollectionUnavailable();
    expect((await list(get("/api/collection"))).status).toBe(503);
    expect((await found(post("/api/collection/found", { ...issueTicket(5, 3), index: 0 }))).status).toBe(503);
    broken = new Error("collection read failed: 08006");
    expect((await list(get("/api/collection"))).status).toBe(500);
    expect(error).toHaveBeenCalledWith("collection:", "collection read failed: 08006");
    broken = null;
  });
});
