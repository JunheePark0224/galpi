const LIMIT = 120;
const LONG_FIRST = 200;
const CUT = 150;

/** Whole sentences only (YES24 terms: no meaning-changing edits). */
export function truncateIntro(text: string): { text: string; truncated: boolean } {
  const full = text.replace(/\s+/g, " ").trim();
  // A terminator ends a sentence only before whitespace or end of text, so "Node.js" and "3.12" stay whole.
  const sentences = full.match(/.+?[.!?]+["'”’)」』]*(?=\s|$)|.+$/g) ?? [full];
  const first = sentences[0].trim();
  if (first.length > LONG_FIRST) return { text: `${first.slice(0, CUT).trimEnd()}…`, truncated: true };
  let out = "";
  for (const sentence of sentences) {
    out = `${out} ${sentence.trim()}`.trim();
    if (out.length >= LIMIT) break;
  }
  return { text: out, truncated: out.length < full.length };
}
