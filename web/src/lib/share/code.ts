import { ANIMALS, BACKGROUNDS, GROUND_PROPS, isRare, type ArtCombo, type Background } from "@/lib/art/combine";
import { walkPath, type Answer, type AnswerChoice, type QuestionMap } from "@/lib/paths";

/**
 * F-27 공유 링크 `/s/<code>` (10-07): what a shared 뒤표지 needs to be drawn again — the path's answers, the five books in
 * order and each one's picture. No person, no session, no signature: a code only ever draws one of our screens (it
 * records nothing and vouches for nothing in the 도감), so a made-up code is harmless. Readable on purpose:
 *   1~<answers>~<isbns>~<pictures>   answers "0A.1B.3U" (node's place in the map, A/B/U), isbns joined by ".",
 *   pictures three base-36 digits per book (animal · background · ground prop, by list place).
 */
export interface SharedDraw { answers: Answer[]; books: string[]; arts: ArtCombo[] }

const VERSION = "1";
export const MAX_CODE = 400;
/** A draw shows five bookmarks at most (F-05) — a code naming more is not ours. */
export const MAX_BOOKS = 5;
const BG_KEYS = Object.keys(BACKGROUNDS) as Background[];
const CHOICE: Record<AnswerChoice, string> = { A: "A", B: "B", unsure: "U" };
const FROM_CHOICE: Record<string, AnswerChoice> = { A: "A", B: "B", U: "unsure" };
const LISTS = [ANIMALS, BG_KEYS, GROUND_PROPS] as const;

export function encodeShare(map: QuestionMap, d: SharedDraw): string {
  if (!d.books.length) throw new Error("share: no books");
  if (d.arts.length !== d.books.length) throw new Error("share: one picture per book");
  const ids = Object.keys(map.nodes);
  const answers = d.answers.map((ans) => `${ids.indexOf(ans.node).toString(36)}${CHOICE[ans.choice]}`).join(".");
  const arts = d.arts.map((x) => [ANIMALS.indexOf(x.animal), BG_KEYS.indexOf(x.bg), GROUND_PROPS.indexOf(x.ground)]
    .map((n) => n.toString(36)).join("")).join("");
  return [VERSION, answers, d.books.join("."), arts].join("~");
}

function finished(map: QuestionMap, answers: Answer[]): boolean {
  try {
    return walkPath(map, answers).next === null;
  } catch {
    return false;
  }
}

/** The code back, every part checked against the map, the catalog (`known`) and the picture lists — or null. */
export function decodeShare(map: QuestionMap, code: string, known: (isbn: string) => boolean): SharedDraw | null {
  if (code.length > MAX_CODE) return null;
  const parts = code.split("~");
  if (parts.length !== 4 || parts[0] !== VERSION || !parts[1] || !parts[2]) return null;
  const ids = Object.keys(map.nodes);
  const answers: Answer[] = [];
  const raws = parts[1].split(".");
  if (raws.length > ids.length) return null;
  for (const raw of raws) {
    const node = ids[parseInt(raw.slice(0, -1), 36)];
    const choice = FROM_CHOICE[raw.slice(-1)];
    if (!node || !choice) return null;
    answers.push({ node, choice });
  }
  if (!finished(map, answers)) return null;
  const books = parts[2].split(".");
  if (books.length > MAX_BOOKS || new Set(books).size !== books.length || !books.every(known)) return null;
  if (parts[3].length !== books.length * 3) return null;
  const arts: ArtCombo[] = [];
  for (let i = 0; i < books.length; i++) {
    const [animal, bg, ground] = LISTS.map((list, k) => list[parseInt(parts[3][i * 3 + k], 36)]);
    if (!animal || !bg || !ground) return null;
    const parts3 = { animal, bg, ground } as Pick<ArtCombo, "animal" | "bg" | "ground">;
    arts.push({ ...parts3, rare: isRare(parts3) });
  }
  const shared = { answers, books, arts };
  // one spelling per draw: "00A" or upper-case digits would read the same but be another link (and another image to draw)
  return encodeShare(map, shared) === code ? shared : null;
}
