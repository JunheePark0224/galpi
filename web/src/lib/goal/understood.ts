import { yes24SearchUrl } from "@/lib/books/detail";
import { FIELD_OF_TOPIC } from "@/lib/books/taxonomy";
import type { GoalMatch } from "./match";

/**
 * PRD F-24 "이렇게 이해했어요" (mockup C′, 10-01): how a 🎯 goal was understood, said honestly on the first page.
 * keyword ① — topic and keyword(s) · topic ①b — topic only · missing ② — topic, but the specific thing asked for is not on
 * our list · none ③ — the LLM said no topic of ours · nearest — word matching (any fallback) found nothing: it cannot tell,
 * so the nearest topic's books open with the old honest line. Also E-22 `understood` (taxonomy).
 */
export type Understood = "keyword" | "topic" | "missing" | "none" | "nearest";

export function understoodOf(goal: GoalMatch): Understood {
  if (!goal.matched) return goal.method === "llm" ? "none" : "nearest";   // only the LLM may say "not our topic"
  if (goal.method === "llm" && goal.missing) return "missing";   // word matching never yields ② (it cannot tell)
  return goal.keywords.length ? "keyword" : "topic";
}

export const UNDERSTOOD_LABEL = "이렇게 이해했어요";
export const FOUND_SUFFIX = "찾았어요";
export const NOT_YET = "아직 없어요";
export const NOT_COVERED = "아직 갈피가 다루지 않는 주제예요";
/** Visible labels end with " ↗" — an aria-hidden span, so screen readers read the words only. */
export const YES24_FIND = "예스24에서 찾기";
export const REWRITE = "다른 말로 쓰기";
export const JUST_ONE = "🍃 그냥 한 권";
export const similarBooks = (topic: string) => `비슷한 '${topic}' 책을 펼칠게요`;
export const yes24FindMissing = (missing: string) => `예스24에서 '${missing}' 찾기`;

export const YES24_HOME = "https://www.yes24.com/";

/** ② / ③ [예스24에서 찾기]: a search for the short missing phrase only — never the whole note — or YES24's front page. */
export function yes24FindUrl(missing: string | null): string {
  return missing ? yes24SearchUrl(missing) : YES24_HOME;
}

/** How a word ending in a Latin letter is read: the letter's Korean name (SQL → 엘 → 로). Only 엠 · 엔 end in a 받침 other than ㄹ. */
const LETTER_TAKES_EURO = new Set(["m", "n"]);
/** Digits read Sino-Korean: 영 · 삼 · 육 end in a 받침 other than ㄹ (일 · 칠 · 팔 end in ㄹ). */
const DIGIT_TAKES_EURO = new Set(["0", "3", "6"]);

/** 로 / 으로 after `word`: no 받침 or ㄹ → 로, any other 받침 → 으로. Latin letters and digits by how they are read. */
export function roParticle(word: string): "로" | "으로" {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 || jong === 8 ? "로" : "으로";
  }
  if (/[a-z]/i.test(last)) return LETTER_TAKES_EURO.has(last.toLowerCase()) ? "으로" : "로";
  if (/[0-9]/.test(last)) return DIGIT_TAKES_EURO.has(last) ? "으로" : "로";
  return "로";
}

export interface PathSeg { name: string; kind: "reached" | "missing" }

/**
 * 분야 › 주제 › 키워드 — as deep as the goal reached; several keywords share the last segment (" · "). ② appends the
 * missing thing as an unreached segment. ③ and a word-match miss (nearest) have no path.
 */
export function understoodPath(goal: GoalMatch): PathSeg[] {
  const understood = understoodOf(goal);
  if (understood === "none" || understood === "nearest") return [];
  const reached = [FIELD_OF_TOPIC[goal.topic], goal.topic, ...(goal.keywords.length ? [goal.keywords.join(" · ")] : [])]
    .map((name): PathSeg => ({ name, kind: "reached" }));
  return understood === "missing" && goal.missing ? [...reached, { name: goal.missing, kind: "missing" }] : reached;
}

/**
 * ② / ③: open the YES24 search in a new tab, built only at the click. The phrase comes from the visitor's words, so it never
 * sits in a DOM attribute (an href) — Amplitude autocapture sends link hrefs unmasked and Session Replay records attributes.
 */
export function openYes24Search(missing: string | null): void {
  window.open(yes24FindUrl(missing), "_blank", "noopener,noreferrer");
}

/** A name never breaks inside: its spaces become no-break spaces ("돈 관리·투자" stays on one line). */
export const unbreakable = (name: string) => name.replace(/ /g, " ");
