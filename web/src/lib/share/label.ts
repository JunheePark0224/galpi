import { AXES, THICK_MIN, THIN_MAX, type Book } from "@/lib/recommend";
import type { Answer, Effects, QuestionMap } from "@/lib/paths";

/**
 * S-11 뒤표지 "내가 고른 길" (F-27, 10-07 사용자): the choices on the path that every one of the five bookmarks matches.
 * A choice the 운명 card (drawn one level up) or a widened draw does not match simply leaves the label — so whatever the
 * label says is true of all five, and nobody can say "you picked SF but got a Korean novel". The challenge route is not
 * a chip: `challenge` puts "오늘은 낯선 쪽으로 도전" first on the screen (it explains the far books). Answers that set
 * nothing a book could match (the intro "떠오르는 게 있어요", the normal route, 못 잡겠어요) are never chips.
 */
export interface ShareLabel { chips: string[]; challenge: boolean }

/** Shown on the label when no choice holds for all five. */
export const NO_CHIP_LINE = "기분 따라 골랐어요";

/** Whether one book has everything the choice sets (scope and mood alike). Null: the choice sets nothing to match. */
function matches(book: Book, e: Effects): boolean | null {
  const tests: boolean[] = [];
  if (e.entry) tests.push(book.entry === e.entry);
  if (e.genres) tests.push(e.genres.includes(book.genre));
  if (e.topics) tests.push(book.entry === "target" && e.topics.includes(book.topic));
  if (e.keywords) tests.push(book.entry === "target" && book.keywords.some((k) => e.keywords!.includes(k)));
  for (const axis of AXES) {
    const want = e.axes?.[axis];
    if (want !== undefined) tests.push(book.entry === "leaf" && book.axes[axis] === want);
  }
  if (e.len !== undefined && e.len !== 0) tests.push(e.len > 0 ? book.pages <= THIN_MAX : book.pages >= THICK_MIN);
  if (e.ways) tests.push(book.entry === "target" && e.ways.includes(book.way));
  return tests.length ? tests.every(Boolean) : null;
}

export function shareLabel(map: QuestionMap, answers: readonly Answer[], books: readonly Book[]): ShareLabel {
  const chips: string[] = [];
  let challenge = false;
  for (const ans of answers) {
    const node = map.nodes[ans.node];
    if (!node || ans.choice === "unsure") continue;
    const choice = ans.choice === "A" ? node.a : node.b;
    if (choice.effects.mode === "challenge") challenge = true;
    const all = books.length > 0 && books.every((b) => matches(b, choice.effects) === true);
    if (all && !chips.includes(choice.label)) chips.push(choice.label);
  }
  return { chips, challenge };
}
