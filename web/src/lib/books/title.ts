/** Edition notes a publisher adds to the title — not part of the book's name. */
const EDITION = /에디션|판|기념|한정|리커버|완역본/;
/** A trailing list of what the book covers, its items split by "│" or "|" — the shop's keywords, not the book's name. */
const COVERS = /[│|]/;

const NBSP = "\u00a0";
/** A word that is only a joining mark — kept at the end of its line, never starting the next. */
const MARK = /^[:·\-–—&+/]$/;

/**
 * Words that must not be split onto two lines (10-04, "『존재의 세 / 가지 거짓말』"): a one-character word holds on to its
 * neighbour with a no-break space — the next word ("세 가지", "첫 클로드", "R 데이터"), or the one before when it is
 * last ("통계 편") — and a joining mark (":", "&", "·") holds on to the word before it.
 */
function holdShortWords(name: string): string {
  const words = name.split(" ");
  return words.reduce((out, word, i) => {
    if (i === 0) return word;
    const prev = words[i - 1];
    const glue = MARK.test(word) || (prev.length === 1 && !MARK.test(prev)) || (i === words.length - 1 && word.length === 1);
    return out + (glue ? NBSP : " ") + word;
  }, "");
}

/**
 * How a book title is written on a bookmark (front and back, 10-04 user request): inside 『 』, the Korean book mark, without
 * the shop's edition labels — a leading "[예스리커버]", a trailing "(30만 부 기념 개정판)", a trailing " : 50주년 기념판" — and a
 * trailing list of what it covers ("(수업혁신사례연구대회│디지털교육연구대회│…)", 10-08).
 * A trailing note that is part of the name ("(RPA)", "(원칙편)") stays. Short words hold on to their neighbours.
 */
export function bookTitle(title: string): string {
  const name = title.trim().replace(/\s+/g, " ")
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(([^()]*)\)$/, (note, inner: string) => (EDITION.test(inner) || COVERS.test(inner) ? "" : note))
    .replace(/\s+:\s+[^:]*기념판$/, "")
    .trim();
  return `『${holdShortWords(name || title.trim())}』`;
}
