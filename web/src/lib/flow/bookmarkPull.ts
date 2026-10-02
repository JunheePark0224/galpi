/**
 * C-16 helper (S-06 책 속 책갈피): the 만난 날 line of the bookmark back (C-13).
 * The one-time C-14 slip "책갈피를 꺼내 보세요" (`galpi.hint.pull`) was retired on 10-02: the S-06 guide (C-21) lights
 * the peeking bookmark with the same message, once per browser, so the two would have doubled up.
 */

/** "2026. 10. 1." — the visitor's local date (DESIGN C-13 "만난 날 YYYY. M. D."). */
export function metDate(d: Date): string {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
