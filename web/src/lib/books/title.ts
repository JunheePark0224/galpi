/** Edition notes a publisher adds to the title — not part of the book's name. */
const EDITION = /에디션|판|기념|한정|리커버|완역본/;
/** A trailing list of what the book covers, its items split by "│" or "|" — the shop's keywords, not the book's name. */
const COVERS = /[│|]/;
/** A trailing "with" + three or more comma items ("with 스킬, 멀티 에이전트, MCP, 하네스") — the tools covered (10-12). */
const WITH_LIST = /\s+with\s+[^,]+(?:,\s*[^,]+){2,}$/i;
/** A trailing ", " + three or more Latin words and nothing Korean ("LLM RAG ADK MCP LangChain") — shop keywords (10-12). */
const LATIN_LIST = /,\s+(?:[A-Za-z0-9][\w.+-]*\s+){2,}[A-Za-z0-9][\w.+-]*$/;
/** A title this long may not fit the bookmark's three lines (11-12: 38 characters with the author in front did not). */
const LONG_TITLE = 30;
/** A leading "<name> 교수의 " — the author's name and a job title, said again on the author line under the title (11-12). */
const TITLED_NAME = /^(\S+)\s?(?:교수|박사|선생님|선생|작가|원장|셰프|변호사|회계사|기자|약사|의사)의\s+/;

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
 * trailing list of what it covers ("(수업혁신사례연구대회│디지털교육연구대회│…)", 10-08; "with 스킬, 멀티 에이전트, MCP, 하네스" and
 * ", LLM RAG ADK MCP LangChain", 10-12 — three items or more, so "with 파이썬" stays).
 * A trailing note that is part of the name ("(RPA)", "(원칙편)") stays. Short words hold on to their neighbours.
 * A long title (LONG_TITLE+) that opens with the author's own name and job title ("구만수 교수의 …", 11-12) drops that opening —
 * the author line says the name; a short one keeps it ("김대석 셰프의 집밥 레시피 1").
 */
export function bookTitle(title: string, author?: string): string {
  const name = withoutAuthorInFront(title.trim().replace(/\s+/g, " "), author)
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(([^()]*)\)$/, (note, inner: string) => (EDITION.test(inner) || COVERS.test(inner) ? "" : note))
    .replace(/\s+:\s+[^:]*기념판$/, "")
    .replace(WITH_LIST, "")
    .replace(LATIN_LIST, "")
    .trim();
  return `『${holdShortWords(name || title.trim())}』`;
}

/** "<author> 교수의 …" → "…" when the title is long and the name is the (first) author's. */
function withoutAuthorInFront(title: string, author?: string): string {
  if (!author || [...title].length < LONG_TITLE) return title;
  const m = TITLED_NAME.exec(title);
  const first = author.trim().split(/[\s,·]+/)[0];
  return m && m[1] === first ? title.slice(m[0].length) : title;
}
