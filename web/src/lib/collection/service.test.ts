// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { artsForDraw, collectibleParts, partsOf } from "@/lib/art/combine";
import type { PathDrawResponse } from "@/lib/books/types";
import { toDrawView } from "@/lib/flow/api";
import { mulberry32 } from "@/lib/recommend";
import { memoryCollection } from "./__fixtures__/memoryStore";
import { dexCounts, dexSections, knownItems, recordMeeting } from "./service";
import type { CollectionItem } from "./types";

vi.mock("server-only", () => ({}));
import { isbnsOf } from "./__fixtures__/isbns";
import { isFresh, issueTicket, MIN_SECRET_LENGTH, parseFoundRequest, signingSecret, TICKET_TTL_SECONDS, verifyTicket } from "./ticket";

const ART = { animal: "otter", bg: "galaxy", ground: "none", rare: true } as const;
const item = (kind: CollectionItem["kind"], value: string, isNew = false): CollectionItem =>
  ({ kind, value, firstMetAt: "2026-10-05T00:00:00Z", firstArt: { ...ART }, isNew });

describe("도감 service", () => {
  it("records the bookmark the ticket points at, and returns the new parts with their tier", async () => {
    const store = memoryCollection([item("animal", artsForDraw(5, 8)[1].animal)]);
    const found = await recordMeeting(store, { seed: 8, count: 5 }, 1);
    const art = artsForDraw(5, 8)[1];
    expect(found.map((f) => `${f.kind}:${f.value}`)).toEqual(collectibleParts(art).slice(1).map((p) => `${p.kind}:${p.value}`));
    expect(found.every((f) => ["common", "limited", "first_edition"].includes(f.tier))).toBe(true);
    expect(await recordMeeting(store, { seed: 8, count: 5 }, 1)).toEqual([]);
  });

  it("never records, returns or counts the empty ground (10-05 fix)", async () => {
    const seed = Array.from({ length: 500 }, (_, s) => s).find((s) => artsForDraw(1, s)[0].ground === "none")!;
    const art = artsForDraw(1, seed)[0];
    const store = memoryCollection();
    const found = await recordMeeting(store, { seed, count: 1 }, 0);
    expect(found.map((f) => f.kind)).toEqual(["animal", "bg"]);
    expect(store.data.items.map((i) => i.kind)).toEqual(["animal", "bg"]);
    expect(store.data.items.map((i) => i.firstArt)).toEqual([art, art]);
    expect(partsOf(art)[2]).toEqual({ kind: "ground", value: "none" });
    // a store that still answers "none" (a row from before the fix): not passed on, so no badge and no E-36
    const old = { items: async () => [], record: async () => [{ kind: "ground" as const, value: "none" }], markSeen: async () => 0, claimKept: async () => true };
    expect(await recordMeeting(old, { seed, count: 1 }, 0)).toEqual([]);
    // old "none" rows in production are ignored on read: not shown, not counted
    const rows = [item("ground", "none"), item("ground", "grass")];
    expect(knownItems(rows)).toEqual([item("ground", "grass")]);
    expect(dexCounts(knownItems(rows)).prop).toEqual({ found: 1, total: 10 });
    expect(dexSections("prop", rows).flatMap((s) => s.cells).some((c) => c.value === "none")).toBe(false);
  });

  it("drops a stored part that is no longer drawn", async () => {
    const store = { items: async () => [], record: async () => [{ kind: "animal" as const, value: "dragon" }], markSeen: async () => 0, claimKept: async () => true };
    expect(await recordMeeting(store, { seed: 1, count: 1 }, 0)).toEqual([]);
    expect(knownItems([item("animal", "dragon"), item("bg", "galaxy")])).toEqual([item("bg", "galaxy")]);
  });

  it("lays the tabs out by tier, props = the ground props (10-07 A), with the person's rows in place", () => {
    const items = [item("animal", "cat"), item("animal", "bluedragon", true), item("bg", "summer"), item("ground", "goldbook")];
    const animals = dexSections("animal", items);
    expect(animals.map((s) => [s.tier, s.cells.length, s.found])).toEqual([["common", 7, 1], ["limited", 6, 0], ["first_edition", 4, 1]]);
    expect(animals[2].cells.find((c) => c.value === "bluedragon")?.met?.isNew).toBe(true);
    const props = dexSections("prop", items);
    expect(props.map((s) => [s.tier, s.cells.length, s.found])).toEqual([["common", 4, 0], ["limited", 4, 0], ["first_edition", 2, 1]]);
    expect(props.flatMap((s) => s.cells).every((c) => c.kind === "ground")).toBe(true);
    expect(dexSections("bg", items).map((s) => [s.tier, s.cells.length, s.found])).toEqual([["common", 6, 0], ["limited", 4, 1], ["first_edition", 2, 0]]);
    expect(dexCounts(items)).toEqual({ animal: { found: 2, total: 17 }, bg: { found: 1, total: 12 }, prop: { found: 1, total: 10 } });
  });

  it("leaves out a sky row recorded before 10-07 A (not a part any more)", () => {
    const old = { ...item("ground", "grass"), kind: "sky" } as unknown as ReturnType<typeof item>;
    expect(knownItems([old, item("ground", "grass")])).toEqual([item("ground", "grass")]);
  });

  it("records exactly the picture the browser showed: toDrawView's art = recordMeeting's art, 200 seeds × every index", async () => {
    const rng = mulberry32(20261005);
    for (let n = 0; n < 200; n++) {
      const seed = Math.floor(rng() * 2 ** 32);
      const count = 1 + Math.floor(rng() * 10);
      const res = {
        picks: Array.from({ length: count }, (_, i) => ({ card: { id: `b${i}` }, kind: "match", reason: null })),
        exhausted: false, widened: false, path: {}, art: { seed, count, iat: 1, sub: null, sig: "s", isbns: Array.from({ length: count }, (_, i) => `b${i}`) },
      } as unknown as PathDrawResponse;
      const view = toDrawView(res, seed + 1);                                      // the fallback seed is never used
      expect(view.ticket?.seed).toBe(seed);
      for (let index = 0; index < count; index++) {
        const store = memoryCollection();
        await recordMeeting(store, { seed, count }, index);
        const shown = view.picks[index].art;
        expect(store.data.items.map((i) => i.firstArt), `seed ${seed} index ${index}`).toEqual(collectibleParts(shown).map(() => shown));
        expect(store.data.items.map((i) => `${i.kind}:${i.value}`)).toEqual(collectibleParts(shown).map((p) => `${p.kind}:${p.value}`));
      }
    }
  });
});

describe("art tickets (server-signed seeds)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("verifies its own signature and rejects any change", () => {
    const secret = signingSecret()!;
    const t = issueTicket(isbnsOf(5), { seed: 4242, sub: "11111111-1111-4111-8111-111111111111" }) as ReturnType<typeof issueTicket> & { sig: string };
    expect(verifyTicket(t, secret)).toBe(true);
    expect(verifyTicket({ ...t, iat: t.iat - 1 }, secret)).toBe(false);
    expect(verifyTicket({ ...t, sub: null }, secret)).toBe(false);
    expect(verifyTicket({ ...t, sub: "22222222-2222-4222-8222-222222222222" }, secret)).toBe(false);
    expect(verifyTicket({ ...t, seed: 4243 }, secret)).toBe(false);
    expect(verifyTicket({ ...t, count: 4 }, secret)).toBe(false);
    expect(verifyTicket({ ...t, isbns: isbnsOf(5, 1) }, secret)).toBe(false);                 // other books
    expect(verifyTicket({ ...t, isbns: [...t.isbns].reverse() }, secret)).toBe(false);       // the same books, another order
    expect(verifyTicket({ ...t, sig: `${t.sig.slice(0, -1)}${t.sig.endsWith("A") ? "B" : "A"}` }, secret)).toBe(false);
    expect(verifyTicket({ ...t, sig: "short" }, secret)).toBe(false);
    expect(verifyTicket(t, "another secret")).toBe(false);
  });

  it("uses the configured secret, a dev-only one outside production, none in production", () => {
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "  configured  ");
    expect(signingSecret()).toBe("configured");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "");
    expect(signingSecret()).toMatch(/dev-only/);
    vi.stubEnv("NODE_ENV", "production");
    expect(signingSecret()).toBeNull();
    expect(issueTicket(isbnsOf(5)).sig).toBeNull();
  });

  it("fails closed in production with a secret shorter than 32 characters, saying so once in the log", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "x".repeat(MIN_SECRET_LENGTH - 1));
    expect(signingSecret()).toBeNull();
    expect(signingSecret()).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0].join(" ")).not.toContain("xxxx");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "x".repeat(MIN_SECRET_LENGTH));
    expect(signingSecret()).toBe("x".repeat(MIN_SECRET_LENGTH));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "short-is-fine-outside-production");
    expect(signingSecret()).toBe("short-is-fine-outside-production");
    error.mockRestore();
  });

  it("knows a fresh ticket from an old or future one", () => {
    expect(isFresh(1000, 1000 + TICKET_TTL_SECONDS)).toBe(true);
    expect(isFresh(1000, 1001 + TICKET_TTL_SECONDS)).toBe(false);
    expect(isFresh(1300, 1000)).toBe(true);
    expect(isFresh(1301, 1000)).toBe(false);
    expect(isFresh(Math.floor(Date.now() / 1000))).toBe(true);
  });

  it("makes a fresh 32-bit seed for every draw", () => {
    const a = issueTicket(isbnsOf(5));
    const b = issueTicket(isbnsOf(5));
    expect(a.seed).not.toBe(b.seed);
    expect(Number.isInteger(a.seed) && a.seed >= 0 && a.seed < 2 ** 32).toBe(true);
  });

  it("reads a found request strictly (v3: the draw's books, one per bookmark)", () => {
    const sig = "a".repeat(43);
    const isbns = isbnsOf(5);
    const base = { seed: 1, count: 5, iat: 9, sig, isbns };
    expect(parseFoundRequest({ ...base, index: 4 })).toEqual({ seed: 1, count: 5, iat: 9, sub: null, sig, isbns, index: 4 });
    const sub = "11111111-1111-4111-8111-111111111111";
    expect(parseFoundRequest({ ...base, sub, index: 0 })?.sub).toBe(sub);
    for (const bad of [null, [], { seed: 1, count: 5, sig, isbns, index: 0 }, { ...base, iat: 1.5, index: 0 },
      { ...base, sub: "nobody", index: 0 }, { ...base, sub: 5, index: 0 },
      { ...base, index: 5 }, { ...base, seed: 1.5, index: 0 }, { ...base, count: 0, isbns: [], index: 0 },
      { ...base, count: 11, isbns: isbnsOf(11), index: 0 }, { ...base, sig: "a".repeat(42), index: 0 }, { ...base, sig: `${"a".repeat(42)}=`, index: 0 },
      { ...base, seed: "1", index: 0 },
      { ...base, isbns: undefined, index: 0 },                                   // a v2 ticket (no books)
      { ...base, isbns: isbnsOf(4), index: 0 },                                  // fewer books than bookmarks
      { ...base, isbns: [...isbnsOf(4), "123"], index: 0 },                      // not an ISBN-13
      { ...base, isbns: "9790000000000", index: 0 }]) {
      expect(parseFoundRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
