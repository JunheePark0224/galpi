export type Entry = "leaf" | "target";
export type AxisKey = "temp" | "pull" | "gain" | "world";
export type Tag = -1 | 0 | 1;
/** A book's axis value: a tag, or null when both tagging passes found no signal (비움 — label-dictionary v3.1 rule 9). */
export type AxisValue = Tag | null;
export type Way = "개념" | "실습" | "사례";
export type Rng = () => number;

/** authors: the author names (books/normalize authorNames) — one draw shows one book per name (design 5-3). None = no limit. */
export interface LeafBook { id: string; entry: "leaf"; genre: string; pages: number; axes: Record<AxisKey, AxisValue>; authors?: readonly string[] }
export interface TargetBook {
  id: string; entry: "target"; field: string; topic: string; genre: string;
  pages: number; way: Way; keywords: string[]; authors?: readonly string[];
}
export type Book = LeafBook | TargetBook;

export type BalanceChoice = "A" | "B" | "unsure";
export interface LeafAnswers { temp: number; pull: number; gain: number; world: number; len: Tag }
export interface TargetAnswers { topic: string; way: Way | null; len: Tag; keywords: string[] }

export interface DrawPick { book: Book; score: number; kind: "recommended" | "random" }
export interface DrawResult { picks: DrawPick[]; widened: boolean; exhausted: boolean }

export const AXES: readonly AxisKey[] = ["temp", "pull", "gain", "world"];
