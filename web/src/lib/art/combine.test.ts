// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANIMALS, ART_KINDS, BACKGROUNDS, DEX_TIERS, GROUND_PROPS, KIND_TIERS, LIVING_BACKGROUNDS, TIERS, artFromSeed, artTier, artsForDraw,
  collectibleParts, highestTier, isCollectible, isRare, newArtSeed, partsOf, tierFor, tierOf, type Background, type Tier,
} from "./combine";
import { PART_NAMES } from "./names";

describe("bookmark art", () => {
  it("has the three-part lists (10-07 A) — 16 animals, 12 backgrounds, 7 ground props; no sky props", () => {
    expect(ART_KINDS).toEqual(["animal", "bg", "ground"]);
    expect(ANIMALS).toHaveLength(16);
    expect(Object.keys(BACKGROUNDS)).toHaveLength(12);
    expect(GROUND_PROPS).toHaveLength(7);
    expect(GROUND_PROPS).not.toContain("firefly");
    expect(KIND_TIERS.bg.limited).toEqual(["cherry", "sunset", "aurora", "summer"]);
    expect(KIND_TIERS.ground.limited).toEqual(["clover"]);
    expect(KIND_TIERS.ground.first_edition).toEqual(["goldbook"]);
    expect(KIND_TIERS.animal.limited).toEqual(["redpanda", "fennec", "otter", "panda", "koala"]);
    expect(KIND_TIERS.animal.first_edition).toEqual(["bluedragon", "whitetiger", "redbird", "blacktortoise"]);
    expect(KIND_TIERS.bg.first_edition).toEqual(["galaxy", "study"]);
    expect(KIND_TIERS.ground.common).toContain("none");
  });

  it("makes every 한정판·초판본 background a living one, and no 일반판 background", () => {
    expect([...LIVING_BACKGROUNDS].sort()).toEqual([...KIND_TIERS.bg.limited, ...KIND_TIERS.bg.first_edition].sort());
    for (const bg of KIND_TIERS.bg.common) expect(LIVING_BACKGROUNDS.has(bg as Background)).toBe(false);
  });

  it("lists every value once, in exactly one tier, with a 도감 name", () => {
    const all: Record<string, readonly string[]> = { animal: ANIMALS, bg: Object.keys(BACKGROUNDS), ground: GROUND_PROPS };
    for (const kind of ART_KINDS) {
      const byTier = TIERS.flatMap((t) => KIND_TIERS[kind][t]);
      expect([...byTier].sort()).toEqual([...all[kind]].sort());
      for (const v of byTier) expect(Boolean(PART_NAMES[kind][v]), `${kind} ${v}`).toBe(isCollectible(kind, v));
    }
  });

  it("collects every part but the empty ground — 16 + 12 + 6 cells", () => {
    expect(isCollectible("ground", "none")).toBe(false);
    expect(isCollectible("ground", "grass")).toBe(true);
    expect(isCollectible("sky" as never, "moon")).toBe(false);                // sky props are gone (10-07 A)
    expect(isCollectible("ground", "firefly")).toBe(false);                    // now the 여름밤 background
    expect(isCollectible("animal", "dragon")).toBe(false);
    expect(DEX_TIERS.ground.common).toEqual(["grass", "flowers", "books", "mushroom"]);
    expect(KIND_TIERS.ground.common).toContain("none");                       // still drawn
    const cells = (kind: (typeof ART_KINDS)[number]) => TIERS.flatMap((t) => DEX_TIERS[kind][t]).length;
    expect([cells("animal"), cells("bg"), cells("ground")]).toEqual([16, 12, 6]);
    const art = { animal: "cat", bg: "peach", ground: "none" } as const;
    expect(collectibleParts(art)).toEqual(partsOf(art).slice(0, 2));
    expect(collectibleParts({ ...art, ground: "clover" })).toEqual(partsOf({ ...art, ground: "clover" }));
  });

  it("looks a part's tier up from its value", () => {
    expect(tierOf("animal", "cat")).toBe("common");
    expect(tierOf("animal", "otter")).toBe("limited");
    expect(tierOf("bg", "summer")).toBe("limited");
    expect(tierOf("ground", "goldbook")).toBe("first_edition");
    expect(tierOf("ground", "none")).toBe("common");
    expect(tierOf("bg", "dragon")).toBeNull();
    expect(highestTier([])).toBe("common");
    expect(highestTier(["limited", "common"])).toBe("limited");
    const art = { animal: "cat", bg: "aurora", ground: "goldbook" } as const;
    expect(partsOf(art)).toEqual([{ kind: "animal", value: "cat" }, { kind: "bg", value: "aurora" }, { kind: "ground", value: "goldbook" }]);
    expect(artTier(art)).toBe("first_edition");
    expect(isRare({ animal: "cat", bg: "peach", ground: "none" })).toBe(false);
  });

  it("splits the 0–1 roll 1 / 9 / 90", () => {
    expect(tierFor(0)).toBe("first_edition");
    expect(tierFor(0.0099)).toBe("first_edition");
    expect(tierFor(0.01)).toBe("limited");
    expect(tierFor(0.0999)).toBe("limited");
    expect(tierFor(0.1)).toBe("common");
    expect(tierFor(0.999)).toBe("common");
  });

  it("draws each part's tier 90 / 9 / 1 (20,000 seeded draws, within ±1 point)", () => {
    const counts = Object.fromEntries(ART_KINDS.map((k) => [k, { common: 0, limited: 0, first_edition: 0 } as Record<Tier, number>]));
    const N = 20_000;
    for (let seed = 0; seed < N; seed++) {
      const art = artFromSeed(seed * 7919 + 1);
      for (const p of partsOf(art)) counts[p.kind][tierOf(p.kind, p.value)!] += 1;
    }
    for (const kind of ART_KINDS) {
      expect(Math.abs(counts[kind].common / N - 0.9), `${kind} common`).toBeLessThan(0.01);
      expect(Math.abs(counts[kind].limited / N - 0.09), `${kind} limited`).toBeLessThan(0.01);
      expect(Math.abs(counts[kind].first_edition / N - 0.01), `${kind} first edition`).toBeLessThan(0.01);
    }
  });

  it("reaches every value of every kind", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 4000; seed++) for (const a of artsForDraw(5, seed)) for (const p of partsOf(a)) seen.add(`${p.kind}:${p.value}`);
    expect(seen.size).toBe(16 + 12 + 7);
  });

  it("draws a fixed picture for a fixed seed (the browser and the server must agree — a change here bumps the ticket version)", () => {
    expect(artsForDraw(3, 42)).toEqual([
      { animal: "fox", bg: "night", ground: "flowers", rare: false },
      { animal: "bear", bg: "leaf", ground: "books", rare: false },
      { animal: "cat", bg: "peach", ground: "none", rare: false },
    ]);
  });

  it("draws three parts only — no `sky` key on any picture", () => {
    for (let seed = 0; seed < 200; seed++) expect(Object.keys(artFromSeed(seed)).sort()).toEqual(["animal", "bg", "ground", "rare"]);
  });

  it("redraws the same pictures from the same seed, `rare` true exactly when a part is 한정판 or 초판본", () => {
    expect(artFromSeed(42)).toEqual(artFromSeed(42));
    expect(artFromSeed(42)).toEqual(artsForDraw(1, 42)[0]);
    expect(artsForDraw(5, 99)).toEqual(artsForDraw(5, 99));
    for (let seed = 0; seed < 500; seed++) {
      const a = artFromSeed(seed);
      expect(a.rare).toBe(artTier(a) !== "common");
    }
  });

  it("never repeats a common animal inside a draw of five", () => {
    for (let seed = 0; seed < 300; seed++) {
      const commons = artsForDraw(5, seed).map((a) => a.animal).filter((a) => tierOf("animal", a) === "common");
      expect(new Set(commons).size).toBe(commons.length);
    }
  });

  it("still returns a picture for every pick when a draw has more picks than common animals", () => {
    expect(artsForDraw(9, 1)).toHaveLength(9);
  });

  it("makes 32-bit seeds", () => {
    const s = newArtSeed();
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });

  it("has an SVG in public/animals for every animal", () => {
    for (const animal of ANIMALS) expect(existsSync(path.resolve("public", "animals", `${animal}.svg`))).toBe(true);
  });
});
