export type Entry = "leaf" | "target";
export type AxisKey = "temp" | "pull" | "gain" | "world";
export type Tag = -1 | 0 | 1;
export type Way = "개념" | "실습" | "사례";
export type Rng = () => number;

export interface LeafBook { id: string; entry: "leaf"; genre: string; pages: number; axes: Record<AxisKey, Tag> }
export interface TargetBook {
  id: string; entry: "target"; field: string; topic: string; genre: string;
  pages: number; way: Way; keywords: string[];
}
export type Book = LeafBook | TargetBook;

export type BalanceChoice = "A" | "B" | "unsure";
export interface LeafAnswers { temp: number; pull: number; gain: number; world: number; len: Tag }
export interface TargetAnswers { topic: string; way: Way | null; len: Tag; keywords: string[] }

export interface Pick { book: Book; score: number; kind: "recommended" | "random" }
export interface DrawResult { picks: Pick[]; widened: boolean; exhausted: boolean }

export const AXES: readonly AxisKey[] = ["temp", "pull", "gain", "world"];
