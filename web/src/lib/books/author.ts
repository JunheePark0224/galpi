/**
 * The bookmark's author line holds one line of about 14 characters (12px on the card — the longest names on 10-12, such as
 * "레프 니콜라예비치 톨스토이", fit whole). A longer name — an institution such as "도쿄지케이카이의과대학 부속병원 영양부" —
 * keeps the whole words that fit and ends in "…" (10-12, user). Only the bookmark is shortened; the data keeps the full name.
 */
export const AUTHOR_MAX = 14;

export function bookAuthor(author: string): string {
  const name = author.trim().replace(/\s+/g, " ");
  if ([...name].length <= AUTHOR_MAX) return name;
  const words = name.split(" ");
  let kept = "";
  for (const w of words) {
    const next = kept ? `${kept} ${w}` : w;
    if ([...next].length > AUTHOR_MAX - 1) break;
    kept = next;
  }
  return `${kept || [...name].slice(0, AUTHOR_MAX - 1).join("")}…`;
}
