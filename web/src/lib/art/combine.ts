import { mulberry32, type Rng } from "@/lib/recommend";

/** DESIGN A-01 — files in public/animals (copied from Galpi/assets/animals). */
export const ANIMALS = ["cat", "bear", "rabbit", "fox", "duck", "whale", "owl"] as const;
/** DESIGN A-02 — sky + hill pairs (시안 이름: 복숭아·풀잎·하늘·버터·라벤더·밤). */
export const BACKGROUNDS = {
  peach: { sky: "#F9DCCB", hill: "#E7B597" },
  leaf: { sky: "#E4EFD9", hill: "#A9C69A" },
  sky: { sky: "#DCEAF5", hill: "#A7C2A0" },
  butter: { sky: "#FBF0C9", hill: "#D8C27E" },
  lavender: { sky: "#E7E1F3", hill: "#B8ACD6" },
  night: { sky: "#3E4569", hill: "#5B6B58" },
} as const;
/** DESIGN A-03 */
export const SKY_PROPS = ["moon", "cloud", "stars", "birds", "bigStar"] as const;
export const GROUND_PROPS = ["grass", "flowers", "books", "mushroom", "none"] as const;

export type Animal = (typeof ANIMALS)[number];
export type Background = keyof typeof BACKGROUNDS;
export type SkyProp = (typeof SKY_PROPS)[number];
export type GroundProp = (typeof GROUND_PROPS)[number];

/** PRD D-05: saved with a bookmark so the library redraws it as it was. `rare` is stored now, used later (F-21). */
export interface ArtCombo { animal: Animal; bg: Background; sky: SkyProp; ground: GroundProp; rare: boolean }

const BG_KEYS = Object.keys(BACKGROUNDS) as Background[];

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pictures for one draw, reproducible from the seed. Animals do not repeat while there are enough of them. */
export function artsForDraw(count: number, seed: number): ArtCombo[] {
  const rng = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const animals = shuffled(ANIMALS, rng);
  return Array.from({ length: count }, (_, i) => ({
    animal: i < animals.length ? animals[i] : pick(ANIMALS),
    bg: pick(BG_KEYS),
    sky: pick(SKY_PROPS),
    ground: pick(GROUND_PROPS),
    rare: false,
  }));
}

export function artFromSeed(seed: number): ArtCombo {
  return artsForDraw(1, seed)[0];
}

export function newArtSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
