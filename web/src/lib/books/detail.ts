/**
 * S-06 book facts (PRD F-09·F-14). Fetched when shown, cached briefly, never stored (PRD 6절, CLAUDE.md 보안·약관).
 * Pure: shared by the server route (normalising YES24 / Kakao) and the browser (empty state on a failed request).
 */

export type DetailSource = "yes24" | "kakao";

export interface BookDetail {
  source: DetailSource | null;   // null: nothing came back — the screen shows our own card only
  cover: string | null;          // https image URL from an allowed host
  price: number | null;          // sale price in won
  rating: number | null;         // YES24 star score (0–10); null when the book has none
  pages: number | null;
  intro: string;                 // the whole introduction, tags and entities removed ("" when none) — cut on screen only
  link: string;                  // the YES24 product page, or a YES24 search for the ISBN
}

const COVER_HOSTS = ["image.yes24.com"];
const KAKAO_COVER_SUFFIX = ".kakaocdn.net";
const LINK_HOSTS = ["www.yes24.com"];

/** Always a working [예스24에서 보기]: YES24's own search for the ISBN (no personal data in the URL). */
export function yes24SearchUrl(isbn: string): string {
  return `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(isbn)}`;
}

export function emptyDetail(isbn: string): BookDetail {
  return { source: null, cover: null, price: null, rating: null, pages: null, intro: "", link: yes24SearchUrl(isbn) };
}

/** https URL on an allowed host (http is upgraded), else null. No credentials or non-default port: only the plain host. */
function safeUrl(x: unknown, allowed: (host: string) => boolean): string | null {
  if (typeof x !== "string" || !x) return null;
  try {
    const url = new URL(x);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!allowed(url.hostname) || url.username || url.password || url.port) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

const positive = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null);

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", middot: "·", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function decodeEntity(entity: string, body: string): string {
  if (body[0] === "#") {
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    const valid = Number.isInteger(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
    return valid ? String.fromCodePoint(code) : entity;
  }
  return NAMED[body.toLowerCase()] ?? entity;
}

/**
 * YES24 text carries <b>/<br> tags, entities, CRLF and "__" indent markers (src/build_check_page.py `clean`).
 * Removes only those — the words and their order stay (terms: no meaning-changing edits). Paragraph breaks survive.
 */
export function cleanIntro(raw: string): string {
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\r\n?/g, "\n");
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s_]+/, "").replace(/[ \t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** GET /v1/goods/itemDetail?searchType=ISBN13&query=…&detail=Y — null unless it is a success for this very ISBN. */
export function fromYes24(json: unknown, isbn: string): BookDetail | null {
  if (!isObject(json) || json.success !== true || !isObject(json.data) || !Array.isArray(json.data.items)) return null;
  const item = json.data.items.find((it) => isObject(it) && it.isbn13 === isbn);
  if (!isObject(item)) return null;
  const content = isObject(item.contentDetail) ? item.contentDetail : {};
  const intro = typeof content.bookIntroduction === "string" ? cleanIntro(content.bookIntroduction) : "";
  return {
    source: "yes24",
    cover: safeUrl(item.cover, (h) => COVER_HOSTS.includes(h)),
    price: positive(item.salePrice),
    rating: positive(item.starScore),
    pages: positive(item.pages),
    intro,
    link: safeUrl(item.link, (h) => LINK_HOSTS.includes(h)) ?? yes24SearchUrl(isbn),
  };
}

/** Kakao book search by ISBN (PRD F-14: price and cover only). `isbn` there is "ISBN10 ISBN13". */
export function fromKakao(json: unknown, isbn: string): BookDetail | null {
  if (!isObject(json) || !Array.isArray(json.documents)) return null;
  const doc = json.documents.find((d) => isObject(d) && typeof d.isbn === "string" && d.isbn.split(/\s+/).includes(isbn));
  if (!isObject(doc)) return null;
  const cover = safeUrl(doc.thumbnail, (h) => h.endsWith(KAKAO_COVER_SUFFIX));
  const price = positive(doc.sale_price) ?? positive(doc.price);
  if (!cover && !price) return null;
  return { source: "kakao", cover, price, rating: null, pages: null, intro: "", link: yes24SearchUrl(isbn) };
}
