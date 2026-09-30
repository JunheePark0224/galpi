import { QUESTION_AXIS, type BalanceChoice, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
import { TOPICS, WAYS } from "./taxonomy";
import type { Vocab } from "./types";

export type DrawQuery = { entry: "leaf"; choices: BalanceChoice[] } | { entry: "target"; answers: TargetAnswers };
export interface DrawRequest { query: DrawQuery; seen: string[]; seed: number | null }

export const MAX_SEEN = 1000;
const MAX_ID = 32;
const MAX_KEYWORDS = 5;
const CHOICES: ReadonlySet<unknown> = new Set(["A", "B", "unsure"]);

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function parseSeen(x: unknown): string[] | null {
  if (x === undefined) return [];
  if (!Array.isArray(x) || x.length > MAX_SEEN) return null;
  return x.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ID) ? (x as string[]) : null;
}

/** undefined = invalid, null = not given. */
function parseSeed(x: unknown): number | null | undefined {
  if (x === undefined) return null;
  return typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 2 ** 32 ? x : undefined;
}

function parseTarget(x: unknown, vocab: Vocab): TargetAnswers | null {
  if (!isObject(x)) return null;
  const { topic, way, len, keywords } = x;
  if (typeof topic !== "string" || !(TOPICS as readonly string[]).includes(topic)) return null;
  if (way !== null && !WAYS.includes(way as Way)) return null;
  if (len !== -1 && len !== 0 && len !== 1) return null;
  if (!Array.isArray(keywords) || keywords.length > MAX_KEYWORDS) return null;
  const known = vocab[topic]?.keywords ?? {};
  if (!keywords.every((k) => typeof k === "string" && Object.hasOwn(known, k))) return null;
  return { topic, way: way as Way | null, len: len as Tag, keywords: keywords as string[] };
}

/** Strict check of the draw body: anything unexpected is a 400, never a silent default. */
export function parseDrawRequest(body: unknown, vocab: Vocab): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  if (body.entry === "leaf") {
    const c = body.choices;
    if (!Array.isArray(c) || c.length !== QUESTION_AXIS.length || !c.every((v) => CHOICES.has(v))) return null;
    return { query: { entry: "leaf", choices: c as BalanceChoice[] }, seen, seed };
  }
  if (body.entry === "target") {
    const answers = parseTarget(body.answers, vocab);
    return answers ? { query: { entry: "target", answers }, seen, seed } : null;
  }
  return null;
}
