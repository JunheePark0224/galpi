import type { BalanceChoice, Entry } from "@/lib/recommend";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";
import type { GoalMatch } from "@/lib/goal/match";
import { QUESTIONS } from "./questions";
import { EMPTY_FORM, type TargetForm } from "./target";

export type Step = "home" | "leaf" | "target" | "book" | "first" | "bookmarks" | "end";
export const STEPS: readonly Step[] = ["home", "leaf", "target", "book", "first", "bookmarks", "end"];
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
  seen: string[];                         // books shown in this session — excluded from later draws (F-05)
}

export const INITIAL: FlowState = {
  step: "home", entry: null, choices: [], prevChoices: null, form: EMPTY_FORM, prevForm: null, goal: null,
  status: "idle", drawId: 0, draw: null, opened: false, edited: false, index: 0, reactions: [], seen: [],
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
  | { type: "home" };

/** Ask for a new draw: to S-03 the first time, straight back to the open book after an edit. */
function requestDraw(s: FlowState): FlowState {
  return { ...s, status: "loading", drawId: s.drawId + 1, draw: null, step: s.opened ? "first" : "book" };
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
      return s.step === "target" ? requestDraw({ ...s, form: a.form, goal: a.goal }) : s;
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
      if (index >= s.draw.picks.length) return { ...s, reactions, step: "end" };
      return { ...s, reactions, index, seen: addSeen(s.seen, s.draw.picks[index].card.id) };
    }
    case "home":
      return { ...INITIAL, seen: s.seen };
  }
}
