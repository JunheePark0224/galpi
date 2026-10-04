/** Edition notes a publisher adds to the title — not part of the book's name. */
const EDITION = /에디션|판|기념|한정|리커버|완역본/;

/**
 * How a book title is written on a bookmark (front and back, 10-04 user request): inside 『 』, the Korean book mark, without
 * the shop's edition labels — a leading "[예스리커버]", a trailing "(30만 부 기념 개정판)", a trailing " : 50주년 기념판".
 * A trailing note that is part of the name ("(RPA)", "(원칙편)") stays.
 */
export function bookTitle(title: string): string {
  const name = title.trim().replace(/\s+/g, " ")
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(([^()]*)\)$/, (note, inner: string) => (EDITION.test(inner) ? "" : note))
    .replace(/\s+:\s+[^:]*기념판$/, "")
    .trim();
  return `『${name || title.trim()}』`;
}
