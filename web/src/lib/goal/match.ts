import { topicsIn } from "@/lib/books/active";
import { MAX_KEYWORDS, TOPIC_CHIPS, TOPICS, type Topic } from "@/lib/books/taxonomy";
import type { Vocab } from "@/lib/books/types";

/** target-chips.md 1절: 직접 쓰기 is 30 characters. */
export const GOAL_MAX = 30;

export interface GoalMatch {
  text: string;          // what the person wrote, trimmed, at most 30 characters (E-21)
  topic: Topic;
  keywords: string[];    // only names from our closed keyword list
  matched: boolean;      // false: nothing in our list matched — topic is only the nearest guess
  method: "word" | "llm" | "example"; // llm: Claude Haiku sorted it (P4, /api/goal/classify); word: this file; example: an
                                       // untouched S-02 example chip (lib/flow/examples.ts) — not the visitor's own words
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Topic name, chip label, folded / too-common words and keyword names, cut at "·" and spaces (2+ letters). */
function topicWords(topic: Topic, vocab: Vocab): string[] {
  const label = TOPIC_CHIPS.find((c) => c.topic === topic)?.label ?? topic;
  const words = [topic, label, ...(vocab[topic]?.terms ?? []), ...Object.keys(vocab[topic]?.keywords ?? {})];
  return [...new Set(words.flatMap((w) => w.split(/[·\s]+/)).map(squash).filter((w) => w.length >= 2))];
}

/** Highest score wins; topic order breaks ties; all zero keeps the first topic. */
function rank(topics: readonly Topic[], score: (topic: Topic) => number): { topic: Topic; score: number } {
  return topics.reduce<{ topic: Topic; score: number }>((best, topic) => {
    const s = score(topic);
    return s > best.score ? { topic, score: s } : best;
  }, { topic: topics[0] ?? TOPICS[0], score: 0 });
}

/**
 * Word matching for 직접 쓰기 — only inside the topics and keywords of `vocab` (callers pass the active ones,
 * lib/books/active.ts). The fallback behind the LLM (P4) and offline.
 */
export function matchGoal(input: string, vocab: Vocab): GoalMatch {
  const text = input.trim().slice(0, GOAL_MAX);
  const flat = squash(text);
  const topics = topicsIn(vocab);
  const base = { text, keywords: [] as string[], method: "word" as const };
  if (!flat) return { ...base, topic: topics[0] ?? TOPICS[0], matched: false };

  let top: { topic: Topic; keywords: string[] } | null = null;
  for (const topic of topics) {
    const hits = Object.entries(vocab[topic]?.keywords ?? {})
      .filter(([, pattern]) => new RegExp(pattern, "i").test(text))
      .map(([name]) => name);
    if (hits.length > (top?.keywords.length ?? 0)) top = { topic, keywords: hits };
  }
  // The server takes at most MAX_KEYWORDS: keep the first ones in vocab order.
  if (top) return { ...base, topic: top.topic, keywords: top.keywords.slice(0, MAX_KEYWORDS), matched: true };

  const byWords = rank(topics, (topic) => topicWords(topic, vocab).filter((w) => flat.includes(w)).length);
  if (byWords.score > 0) return { ...base, topic: byWords.topic, matched: true };

  const grams = bigrams(flat);
  const nearest = rank(topics, (topic) => topicWords(topic, vocab).reduce((n, w) => n + [...bigrams(w)].filter((g) => grams.has(g)).length, 0));
  return { ...base, topic: nearest.topic, matched: false };
}
