import { QUESTION_AXIS, type BalanceChoice, type Tag, type TargetAnswers, type Way } from "@/lib/recommend";
import { PathError, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import { MAX_KEYWORDS, TOPICS, WAYS } from "./taxonomy";
import type { Vocab } from "./types";

export type DrawQuery =
  | { entry: "leaf"; choices: BalanceChoice[] }
  | { entry: "target"; answers: TargetAnswers }
  | { entry: "path"; answers: Answer[] };
export interface DrawRequest { query: DrawQuery; seen: string[]; seed: number | null }

export const MAX_SEEN = 1000;
const MAX_ID = 32;
const CHOICES: ReadonlySet<unknown> = new Set(["A", "B", "unsure"]);

/** v2: the most answers one path can take is 11 today; 40 leaves room for a longer map, and caps the body. */
export const MAX_ANSWERS = 40;
const MAX_NODE = 64;

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
  if (!Array.isArray(keywords)) return null;
  const known = vocab[topic]?.keywords ?? {};
  if (!keywords.every((k) => typeof k === "string" && Object.hasOwn(known, k))) return null;
  const unique = [...new Set(keywords as string[])];          // a repeat is counted once
  if (unique.length > MAX_KEYWORDS) return null;
  return { topic, way: way as Way | null, len: len as Tag, keywords: unique };
}

/** A finished path of the map, each answer exactly { node, choice } — anything else is null. */
function parseAnswers(x: unknown, map: QuestionMap): Answer[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_ANSWERS) return null;
  const ok = x.every((a) => isObject(a) && Object.keys(a).length === 2 && typeof a.node === "string"
    && a.node.length <= MAX_NODE && CHOICES.has(a.choice));
  if (!ok) return null;
  const answers = (x as Answer[]).map(({ node, choice }) => ({ node, choice }));
  try {
    return walkPath(map, answers).next === null ? answers : null;
  } catch (e) {
    if (e instanceof PathError) return null;
    throw e;
  }
}

/** Strict check of the draw body: anything unexpected is a 400, never a silent default. */
export function parseDrawRequest(body: unknown, vocab: Vocab, map: QuestionMap = QUESTION_MAP): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  if (body.entry === undefined) {
    const answers = parseAnswers(body.answers, map);
    return answers ? { query: { entry: "path", answers }, seen, seed } : null;
  }
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
