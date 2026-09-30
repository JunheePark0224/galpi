/** Postgres jsonb refuses U+0000 and unpaired UTF-16 surrogates; the event is worth more than those characters. */
const NUL = /\u0000/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Real events are a few levels deep; anything past this is a crafted body, not a recursion we should attempt. */
export const MAX_DEPTH = 32;

export class TooDeepError extends Error {
  constructor() {
    super("json nested too deeply");
  }
}

export function cleanText(s: string): string {
  return s.replace(NUL, "").replace(LONE_SURROGATE, "\uFFFD");
}

function walk(x: unknown, depth: number): unknown {
  if (typeof x === "string") return cleanText(x);
  if (typeof x !== "object" || x === null) return x;
  if (depth > MAX_DEPTH) throw new TooDeepError();
  if (Array.isArray(x)) return x.map((v) => walk(v, depth + 1));
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [cleanText(k), walk(v, depth + 1)]));
}

/**
 * Deep copy of parsed JSON with every string (values and object keys) cleaned. Keys such as "__proto__" stay plain own keys.
 * Throws TooDeepError past MAX_DEPTH levels of arrays/objects.
 */
export function cleanJson(x: unknown): unknown {
  return walk(x, 1);
}
