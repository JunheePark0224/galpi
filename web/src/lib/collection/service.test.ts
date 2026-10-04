// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { artsForDraw, partsOf } from "@/lib/art/combine";
import { memoryCollection } from "./__fixtures__/memoryStore";
import { dexCounts, dexSections, knownItems, recordMeeting } from "./service";
import type { CollectionItem } from "./types";

vi.mock("server-only", () => ({}));
import { issueTicket, parseFoundRequest, signingSecret, verifyTicket } from "./ticket";

const ART = { animal: "otter", bg: "galaxy", sky: "moon", ground: "none", rare: true } as const;
const item = (kind: CollectionItem["kind"], value: string, isNew = false): CollectionItem =>
  ({ kind, value, firstMetAt: "2026-10-05T00:00:00Z", firstArt: { ...ART }, isNew });

describe("도감 service", () => {
  it("records the bookmark the ticket points at, and returns the new parts with their tier", async () => {
    const store = memoryCollection([item("animal", artsForDraw(5, 8)[1].animal)]);
    const found = await recordMeeting(store, { seed: 8, count: 5 }, 1);
    const art = artsForDraw(5, 8)[1];
    expect(found.map((f) => `${f.kind}:${f.value}`)).toEqual(partsOf(art).slice(1).map((p) => `${p.kind}:${p.value}`));
    expect(found.every((f) => ["common", "limited", "first_edition"].includes(f.tier))).toBe(true);
    expect(await recordMeeting(store, { seed: 8, count: 5 }, 1)).toEqual([]);
  });

  it("drops a stored part that is no longer drawn", async () => {
    const store = { items: async () => [], record: async () => [{ kind: "animal" as const, value: "dragon" }], markSeen: async () => 0 };
    expect(await recordMeeting(store, { seed: 1, count: 1 }, 0)).toEqual([]);
    expect(knownItems([item("animal", "dragon"), item("bg", "galaxy")])).toEqual([item("bg", "galaxy")]);
  });

  it("lays the tabs out by tier, props = sky + ground, with the person's rows in place", () => {
    const items = [item("animal", "cat"), item("animal", "bluedragon", true), item("sky", "rainbow"), item("ground", "goldbook")];
    const animals = dexSections("animal", items);
    expect(animals.map((s) => [s.tier, s.cells.length, s.found])).toEqual([["common", 7, 1], ["limited", 5, 0], ["first_edition", 4, 1]]);
    expect(animals[2].cells.find((c) => c.value === "bluedragon")?.met?.isNew).toBe(true);
    const props = dexSections("prop", items);
    expect(props.map((s) => [s.tier, s.cells.length, s.found])).toEqual([["common", 10, 0], ["limited", 4, 1], ["first_edition", 2, 1]]);
    expect(props[0].cells.map((c) => c.kind)).toEqual([...Array(5).fill("sky"), ...Array(5).fill("ground")]);
    expect(dexCounts(items)).toEqual({ animal: { found: 2, total: 16 }, bg: { found: 0, total: 11 }, prop: { found: 2, total: 16 } });
  });
});

describe("art tickets (server-signed seeds)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("verifies its own signature and rejects any change", () => {
    const secret = signingSecret()!;
    const t = issueTicket(5, 4242) as { seed: number; count: number; sig: string };
    expect(verifyTicket(t, secret)).toBe(true);
    expect(verifyTicket({ ...t, seed: 4243 }, secret)).toBe(false);
    expect(verifyTicket({ ...t, count: 4 }, secret)).toBe(false);
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
    expect(issueTicket(5).sig).toBeNull();
  });

  it("makes a fresh 32-bit seed for every draw", () => {
    const a = issueTicket(5);
    const b = issueTicket(5);
    expect(a.seed).not.toBe(b.seed);
    expect(Number.isInteger(a.seed) && a.seed >= 0 && a.seed < 2 ** 32).toBe(true);
  });

  it("reads a found request strictly", () => {
    const sig = "a".repeat(43);
    expect(parseFoundRequest({ seed: 1, count: 5, sig, index: 4 })).toEqual({ seed: 1, count: 5, sig, index: 4 });
    for (const bad of [null, [], { seed: 1, count: 5, sig, index: 5 }, { seed: 1.5, count: 5, sig, index: 0 }, { seed: 1, count: 0, sig, index: 0 },
      { seed: 1, count: 11, sig, index: 0 }, { seed: 1, count: 5, sig: "a".repeat(42), index: 0 }, { seed: 1, count: 5, sig: `${"a".repeat(42)}=`, index: 0 },
      { seed: "1", count: 5, sig, index: 0 }]) {
      expect(parseFoundRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
