import { PathError, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";

/** v2: a finished path of the question map. */
export interface DrawRequest { answers: Answer[]; seen: string[]; seed: number | null }

export const MAX_SEEN = 1000;
/** The longest path today is 11 answers; 40 leaves room for a longer map and caps the body. */
export const MAX_ANSWERS = 40;
const MAX_ID = 32;
const MAX_NODE = 64;
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
export function parseDrawRequest(body: unknown, map: QuestionMap = QUESTION_MAP): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  const answers = parseAnswers(body.answers, map);
  return answers ? { answers, seen, seed } : null;
}
