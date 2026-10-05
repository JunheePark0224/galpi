import type { AxisKey, Book, Entry, Tag, Way } from "@/lib/recommend";

/** What one answer sets. Scope fields replace the scope at their level; mood fields set a preference; mode switches routes. */
export interface Effects {
  entry?: Entry;
  topics?: string[];
  keywords?: string[];
  genres?: string[];
  axes?: Partial<Record<AxisKey, Tag>>;
  len?: Tag;
  /** One way, or more when a choice covers several ("실제로 써먹는 쪽" = 실습 or 사례) — a book of any of them gets the way points. */
  ways?: Way[];
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

/**
 * Challenge route (design 4절): a scope the person's answers point to → the far scope to draw from instead. Its number is
 * its place in the map (1-based). title: the "N. …" line above the block. pick "one" (10-05 v2): `to.genres` is a list —
 * the draw takes one genre of it (walk.ts applyChallenge). why: the human-written "이동의 뜻" — a draft, data only, not
 * shown on any screen yet.
 */
export interface FarRule { from: Partial<Scope>; to: Partial<Scope>; title?: string; pick?: "one"; why?: string }

/**
 * Where a challenge draw came from and went (10-05 v2) — on the walk applyChallenge returns and in the draw response.
 * from: the person's own scope (genres or topics, or "이야기 · 장르 없음" / "배우기 · 주제 없음" / "섞어서");
 * to: the far genres (for a list rule, the one picked); rule: the far rule's number and title;
 * reasonDraft: the rule's `why:` line — a draft for the result screen later, never shown yet (null where none is written).
 */
export interface Challenge { from: string[]; to: string[]; rule: { n: number; title: string | null }; reasonDraft: string | null }

/**
 * skip: mood questions that cannot change the draw where they would be asked (skip.ts — moodSkips over books.json, built
 * into src/data/mood-skips.json). The walk passes over them as if answered "unsure"; client and server read the same set.
 */
export interface QuestionMap { start: string; nodes: Record<string, QNode>; far: FarRule[]; skip?: ReadonlySet<string> }

export interface Scope { entry: Entry | null; topics: string[] | null; keywords: string[] | null; genres: string[] | null }
export const ALL_SCOPE: Scope = { entry: null, topics: null, keywords: null, genres: null };

export interface Mood { axes: Record<AxisKey, number>; len: Tag; ways: readonly Way[] }
export const NEUTRAL_MOOD: Mood = { axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 0, ways: [] };

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
