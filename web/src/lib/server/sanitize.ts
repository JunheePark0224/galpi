/** Postgres jsonb refuses U+0000 and unpaired UTF-16 surrogates; the event is worth more than those characters. */
const NUL = /\u0000/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanText(s: string): string {
  return s.replace(NUL, "").replace(LONE_SURROGATE, "\uFFFD");
}

/** Deep copy of parsed JSON with every string (values and object keys) cleaned. Keys such as "__proto__" stay plain own keys. */
export function cleanJson(x: unknown): unknown {
  if (typeof x === "string") return cleanText(x);
  if (Array.isArray(x)) return x.map(cleanJson);
  if (typeof x === "object" && x !== null) {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [cleanText(k), cleanJson(v)]));
  }
  return x;
}
