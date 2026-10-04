import type { AxisKey, Book, Entry, Tag, Way } from "@/lib/recommend";

/** What one answer sets. Scope fields replace the scope at their level; mood fields set a preference; mode switches routes. */
export interface Effects {
  entry?: Entry;
  topics?: string[];
  keywords?: string[];
  genres?: string[];
  axes?: Partial<Record<AxisKey, Tag>>;
  len?: Tag;
  way?: Way;
  mode?: "normal" | "challenge";
}

/** One side of a question: its words, what it sets, and the next node id ("draw" = the path ends). */
export interface Choice { label: string; effects: Effects; next: string }

export interface QNode {
  id: string;
  kind: "narrow" | "mood";
  question: string;
  a: Choice;
  b: Choice;
  /** "갈피를 못 잡겠어요": sets nothing; narrow → stop narrowing, mood → skip this question. */
  unsureNext: string;
}

/** Challenge route (design 4절): a scope the person's answers point to → the far scope to draw from instead. */
export interface FarRule { from: Partial<Scope>; to: Partial<Scope> }

export interface QuestionMap { start: string; nodes: Record<string, QNode>; far: FarRule[] }

export interface Scope { entry: Entry | null; topics: string[] | null; keywords: string[] | null; genres: string[] | null }
export const ALL_SCOPE: Scope = { entry: null, topics: null, keywords: null, genres: null };

export interface Mood { axes: Record<AxisKey, number>; len: Tag; way: Way | null }
export const NEUTRAL_MOOD: Mood = { axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 0, way: null };

export type AnswerChoice = "A" | "B" | "unsure";
export interface Answer { node: string; choice: AnswerChoice }

export function inScope(book: Book, s: Scope): boolean {
  if (s.entry !== null && book.entry !== s.entry) return false;
  if (s.genres !== null && !s.genres.includes(book.genre)) return false;
  if (s.topics !== null && (book.entry !== "target" || !s.topics.includes(book.topic))) return false;
  if (s.keywords !== null && (book.entry !== "target" || !book.keywords.some((k) => s.keywords!.includes(k)))) return false;
  return true;
}

export function scopeKey(s: Scope): string {
  const part = (name: string, v: string[] | null) => (v === null ? [] : [`${name}=${[...v].sort().join(",")}`]);
  const parts = [...(s.entry ? [`entry=${s.entry}`] : []), ...part("topics", s.topics), ...part("keywords", s.keywords), ...part("genres", s.genres)];
  return parts.length ? parts.join(";") : "all";
}
