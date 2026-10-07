import { mulberry32, type Rng } from "@/lib/recommend";

/**
 * 도감 v1 (PRD F-21, plans/2026-10-05-collection-dex.md): every part of the picture has three tiers — 일반판 (common),
 * 한정판 (limited), 초판본 (first_edition). Each part is drawn on its own: the tier first (90 / 9 / 1), then evenly inside it.
 */
export const TIERS = ["common", "limited", "first_edition"] as const;
export type Tier = (typeof TIERS)[number];

// 10-07 사용자: 강아지가 일반판에 들어오고 고래는 한정판으로
const ANIMALS_COMMON = ["cat", "bear", "rabbit", "fox", "duck", "owl", "dog"] as const;
const ANIMALS_LIMITED = ["whale", "redpanda", "fennec", "otter", "panda", "koala"] as const;
const ANIMALS_FIRST = ["bluedragon", "whitetiger", "redbird", "blacktortoise"] as const;
/** DESIGN A-01 — files in public/animals (copied from Galpi/assets/animals). */
export const ANIMALS = [...ANIMALS_COMMON, ...ANIMALS_LIMITED, ...ANIMALS_FIRST] as const;

/**
 * DESIGN A-02 — sky + hill pairs (시안 이름: 복숭아·풀잎·하늘·버터·라벤더·밤 / 벚꽃 언덕·노을·오로라·여름밤 / 은하수·금박 서재).
 * 10-07 A (사용자 결정, 시안 `deco/sky.html` A): the sky belongs to the background alone — 일반판 backgrounds are a clean
 * plain sky, 한정판·초판본 ones are "living" (their own gentle motion in BookmarkArt). `sky` here is the sky's colour.
 */
export const BACKGROUNDS = {
  peach: { sky: "#F9DCCB", hill: "#E7B597" },
  leaf: { sky: "#E4EFD9", hill: "#A9C69A" },
  sky: { sky: "#DCEAF5", hill: "#A7C2A0" },
  butter: { sky: "#FBF0C9", hill: "#D8C27E" },
  lavender: { sky: "#E7E1F3", hill: "#B8ACD6" },
  night: { sky: "#3E4569", hill: "#5B6B58" },
  cherry: { sky: "#FBE3EA", hill: "#E8A9BC" },
  sunset: { sky: "#F09A7A", hill: "#7E5A6E" },
  aurora: { sky: "#1D2E4A", hill: "#2C4440" },
  summer: { sky: "#1F2A44", hill: "#33503F" },
  galaxy: { sky: "#141936", hill: "#2E3456" },
  study: { sky: "#7A4A2E", hill: "#5A3420" },
} as const;
export type Background = keyof typeof BACKGROUNDS;
const BG_TIERS: Record<Tier, readonly Background[]> = {
  common: ["peach", "leaf", "sky", "butter", "lavender", "night"],
  limited: ["cherry", "sunset", "aurora", "summer"],
  first_edition: ["galaxy", "study"],
};
/** The backgrounds with their own motion (every 한정판·초판본 one, 10-07 A). */
export const LIVING_BACKGROUNDS: ReadonlySet<Background> = new Set([...BG_TIERS.limited, ...BG_TIERS.first_edition]);

/**
 * DESIGN A-03 — ground props only (10-07 A: the sky props are gone; the fireflies became the 여름밤 background).
 * 10-07 시안 (사용자): 한정판 + 김 나는 찻잔 · 반딧불 유리병 · 깃털 펜과 잉크병, 초판본 + 천상 오르골.
 */
const GROUND_COMMON = ["grass", "flowers", "books", "mushroom", "none"] as const;
const GROUND_LIMITED = ["clover", "teacup", "jar", "quill"] as const;
const GROUND_FIRST = ["goldbook", "musicbox"] as const;
export const GROUND_PROPS = [...GROUND_COMMON, ...GROUND_LIMITED, ...GROUND_FIRST] as const;

export type Animal = (typeof ANIMALS)[number];
export type GroundProp = (typeof GROUND_PROPS)[number];

/**
 * PRD D-05: saved with a bookmark so the library redraws it as it was. `rare` (kept for old records and events): true when
 * any of the three parts is 한정판 or 초판본. The tier of each part is looked up from its value (tierOf) — no stored field.
 */
export interface ArtCombo { animal: Animal; bg: Background; ground: GroundProp; rare: boolean }

/** The three parts a picture is made of (10-07 A) — the 도감's kinds and tabs (동물 · 배경 · 소품 = ground props). */
export const ART_KINDS = ["animal", "bg", "ground"] as const;
export type ArtKind = (typeof ART_KINDS)[number];

/** Every value of a kind, by tier, in the 도감's order. */
export const KIND_TIERS: { readonly [K in ArtKind]: Record<Tier, readonly string[]> } = {
  animal: { common: ANIMALS_COMMON, limited: ANIMALS_LIMITED, first_edition: ANIMALS_FIRST },
  bg: BG_TIERS,
  ground: { common: GROUND_COMMON, limited: GROUND_LIMITED, first_edition: GROUND_FIRST },
};

const TIER_OF: ReadonlyMap<string, Tier> = new Map(
  ART_KINDS.flatMap((kind) => TIERS.flatMap((tier) => KIND_TIERS[kind][tier].map((value) => [`${kind}:${value}`, tier] as const))),
);

/**
 * The ground with nothing on it ("none") is drawn (일반판) but is not a part to collect: never recorded, shown, counted or
 * sent as E-36 (10-05 fix — it was counted as a 소품). Old rows with it are dropped on read (knownItems).
 */
export const EMPTY_GROUND = "none";
export function isCollectible(kind: ArtKind, value: string): boolean {
  return !(kind === "ground" && value === EMPTY_GROUND) && TIER_OF.has(`${kind}:${value}`);
}

/** The 도감's cells: KIND_TIERS without the empty ground. 동물 17 · 배경 12 · 소품 10 (땅 소품). */
export const DEX_TIERS: { readonly [K in ArtKind]: Record<Tier, readonly string[]> } = {
  ...KIND_TIERS,
  ground: { ...KIND_TIERS.ground, common: KIND_TIERS.ground.common.filter((v) => v !== EMPTY_GROUND) },
};

/** The tier of one part, or null for a value that is not in the lists. */
export function tierOf(kind: ArtKind, value: string): Tier | null {
  return TIER_OF.get(`${kind}:${value}`) ?? null;
}

/** The three parts of a picture as (kind, value) pairs. */
export function partsOf(art: Pick<ArtCombo, ArtKind>): { kind: ArtKind; value: string }[] {
  return ART_KINDS.map((kind) => ({ kind, value: art[kind] }));
}

/** The parts of a picture that go into the 도감 (the empty ground left out). */
export function collectibleParts(art: Pick<ArtCombo, ArtKind>): { kind: ArtKind; value: string }[] {
  return partsOf(art).filter((p) => isCollectible(p.kind, p.value));
}

/** 일반판 0 < 한정판 1 < 초판본 2. */
export const TIER_RANK: Readonly<Record<Tier, number>> = { common: 0, limited: 1, first_edition: 2 };
/** The highest tier among the parts (what decides the window's gold rim). */
export function highestTier(tiers: readonly Tier[]): Tier {
  return tiers.reduce<Tier>((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), "common");
}
export function artTier(art: Pick<ArtCombo, ArtKind>): Tier {
  return highestTier(partsOf(art).map((p) => tierOf(p.kind, p.value) ?? "common"));
}
export function isRare(art: Pick<ArtCombo, ArtKind>): boolean {
  return artTier(art) !== "common";
}

/** Published odds (도감 note): 초판본 1%, 한정판 9%, 일반판 the rest — per part. */
export const ODDS = { first_edition: 0.01, limited: 0.09 } as const;
export function tierFor(r: number): Tier {
  if (r < ODDS.first_edition) return "first_edition";
  if (r < ODDS.first_edition + ODDS.limited) return "limited";
  return "common";
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pictures for one draw, reproducible from the seed (the server makes the seed — lib/collection/ticket). Each part:
 * tier by tierFor, then evenly inside the tier. Common animals do not repeat while there are enough of them. The browser
 * and the server run this same function on the same seed; changing what it draws changes every seed's picture, so the
 * ticket's signed version (ticket.ts) goes up with it — an older ticket can never vouch for a picture drawn the old way.
 */
export function artsForDraw(count: number, seed: number): ArtCombo[] {
  const rng = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const commons = shuffled(ANIMALS_COMMON, rng);
  let nextCommon = 0;
  return Array.from({ length: count }, () => {
    const animalTier = tierFor(rng());
    const animal: Animal = animalTier !== "common"
      ? pick(KIND_TIERS.animal[animalTier]) as Animal
      : nextCommon < commons.length ? commons[nextCommon++] : pick(ANIMALS_COMMON);
    const bg = pick(BG_TIERS[tierFor(rng())]);
    const ground = pick(KIND_TIERS.ground[tierFor(rng())]) as GroundProp;
    const parts = { animal, bg, ground };
    return { ...parts, rare: isRare(parts) };
  });
}

export function artFromSeed(seed: number): ArtCombo {
  return artsForDraw(1, seed)[0];
}

export function newArtSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
