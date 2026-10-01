import type { BalanceChoice, Entry } from "@/lib/recommend";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";
import type { GoalMatch } from "@/lib/goal/match";
import { understoodOf } from "@/lib/goal/understood";
import { QUESTIONS } from "./questions";
import { EMPTY_FORM, type TargetForm } from "./target";

export type Step = "home" | "leaf" | "target" | "book" | "first" | "bookmarks" | "result" | "end";
export const STEPS: readonly Step[] = ["home", "leaf", "target", "book", "first", "bookmarks", "result", "end"];
export type Reaction = "pass" | "curious";
export interface PickView { card: BookCard; kind: "recommended" | "random"; art: ArtCombo; reason: Reason }
export interface DrawView { picks: PickView[]; exhausted: boolean; found: number | null; keywords: string[] }
export type DrawStatus = "idle" | "loading" | "ready" | "error";

export interface FlowState {
  step: Step;
  entry: Entry | null;
  choices: BalanceChoice[];               // 🍃 answers of this pass
  prevChoices: BalanceChoice[] | null;    // 🍃 answers before the one edit (E-06)
  form: TargetForm;
  prevForm: TargetForm | null;            // 🎯 form before the one edit (E-06)
  goal: GoalMatch | null;                 // 🎯 written goal, matched to our list
  status: DrawStatus;
  drawId: number;                         // +1 for every draw request; late answers to older requests are ignored
  draw: DrawView | null;
  opened: boolean;
  edited: boolean;                        // the one edit of F-07 is used
  index: number;                          // current bookmark (0-based)
  reactions: Reaction[];
  result: number;                         // S-06: which 궁금해요 book is shown (0-based)
  seen: string[];                         // books shown in this session — excluded from later draws (F-05)
}

export const INITIAL: FlowState = {
  step: "home", entry: null, choices: [], prevChoices: null, form: EMPTY_FORM, prevForm: null, goal: null,
  status: "idle", drawId: 0, draw: null, opened: false, edited: false, index: 0, reactions: [], result: 0, seen: [],
};

export type FlowAction =
  | { type: "start"; entry: Entry }
  | { type: "answer"; choice: BalanceChoice }
  | { type: "submitTarget"; form: TargetForm; goal: GoalMatch | null }
  | { type: "drawn"; id: number; draw: DrawView }
  | { type: "drawFailed"; id: number }
  | { type: "retry" }
  | { type: "open" }
  | { type: "edit" }
  | { type: "next" }
  | { type: "react"; reaction: Reaction }
  | { type: "nextResult" }
  | { type: "redraw" }
  | { type: "home" };

/** Ask for a new draw: to S-03 the first time, straight back to the open book after an edit. */
function requestDraw(s: FlowState): FlowState {
  return { ...s, status: "loading", drawId: s.drawId + 1, draw: null, step: s.opened ? "first" : "book" };
}

/** The 궁금해요 books of this round, in bookmark order — S-06 shows them one by one. */
export function curiousPicks(s: Pick<FlowState, "draw" | "reactions">): PickView[] {
  return (s.draw?.picks ?? []).filter((_, i) => s.reactions[i] === "curious");
}

const addSeen = (seen: string[], id: string) => (seen.includes(id) ? seen : [...seen, id]);

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case "start":
      return { ...INITIAL, seen: s.seen, entry: a.entry, step: a.entry };
    case "answer": {
      if (s.step !== "leaf" || s.choices.length >= QUESTIONS.length) return s;
      const next = { ...s, choices: [...s.choices, a.choice] };
      return next.choices.length === QUESTIONS.length ? requestDraw(next) : next;
    }
    case "submitTarget":
      if (s.step !== "target") return s;
      // F-24 ③: the LLM found no topic of ours — no draw and no bookmarks; the open book says so and offers the ways out.
      // A word-match miss (nearest) still draws the nearest topic's books.
      if (a.goal && understoodOf(a.goal) === "none") {
        return { ...s, form: a.form, goal: a.goal, status: "ready", draw: null, step: s.opened ? "first" : "book" };
      }
      return requestDraw({ ...s, form: a.form, goal: a.goal });
    case "drawn":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "ready", draw: a.draw } : s;
    case "drawFailed":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "error" } : s;
    case "retry":
      return s.status === "error" ? { ...s, status: "loading", drawId: s.drawId + 1 } : s;
    case "open":
      return s.step === "book" ? { ...s, opened: true, step: "first" } : s;
    case "edit":
      if (s.step !== "first" || s.edited) return s;
      return s.entry === "leaf"
        ? { ...s, edited: true, prevChoices: s.choices, choices: [], step: "leaf" }
        : { ...s, edited: true, prevForm: s.form, step: "target" };
    case "next":
      if (s.step !== "first" || s.status !== "ready" || !s.draw || s.draw.picks.length === 0) return s;
      return { ...s, step: "bookmarks", index: 0, reactions: [], seen: addSeen(s.seen, s.draw.picks[0].card.id) };
    case "react": {
      if (s.step !== "bookmarks" || !s.draw) return s;
      const reactions = [...s.reactions, a.reaction];
      const index = s.index + 1;
      if (index >= s.draw.picks.length) {
        // PRD 2절: S-06 when something was 궁금해요, straight to S-08 when nothing was
        return { ...s, reactions, result: 0, step: reactions.includes("curious") ? "result" : "end" };
      }
      return { ...s, reactions, index, seen: addSeen(s.seen, s.draw.picks[index].card.id) };
    }
    case "nextResult": {
      if (s.step !== "result") return s;
      const result = s.result + 1;
      return result < curiousPicks(s).length ? { ...s, result } : { ...s, step: "end" };
    }
    case "redraw":
      // F-10: same conditions, five new books (seen stay excluded), the earlier 궁금해요 do not carry over.
      // A new round gets its own closed book (S-03) and its own one edit (F-07).
      if (s.step !== "end") return s;
      return requestDraw({ ...s, opened: false, edited: false, prevChoices: null, prevForm: null, index: 0, reactions: [], result: 0 });
    case "home":
      return { ...INITIAL, seen: s.seen };
  }
}
