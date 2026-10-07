import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { FoundRequest } from "@/lib/collection/meeting";
import type { ArtTicket } from "@/lib/collection/types";
import type { Answer, AnswerChoice, Challenge, PathSummary } from "@/lib/paths";
import type { Reason } from "@/lib/recommend";
import type { ShareLabel } from "@/lib/share/label";
import { nextQuestion, sameAnswers } from "./path";

export type Step = "home" | "questions" | "book" | "first" | "bookmarks" | "back" | "result" | "end";
export const STEPS: readonly Step[] = ["home", "questions", "book", "first", "bookmarks", "back", "result", "end"];
export type Reaction = "pass" | "curious";
export interface PickView { card: BookCard; kind: "recommended" | "random"; art: ArtCombo; reason: Reason }
/**
 * ticket (도감 v1): the server's signed seed the pictures came from — null when unsigned (nothing is recorded).
 * challenge (10-05 v2): the draw's challenge provenance, kept for the result screen later — not shown yet.
 */
export interface DrawView {
  picks: PickView[]; exhausted: boolean; path: PathSummary; ticket?: ArtTicket | null; challenge?: Challenge | null;
  /** F-27 (10-07): S-11 뒤표지 "내가 고른 길" — the server's chips (lib/share/label). */
  label?: ShareLabel;
}
export type DrawStatus = "idle" | "loading" | "ready" | "error";

export interface FlowState {
  step: Step;
  answers: Answer[];               // the path so far — going back drops the last one
  asked: number;                   // answers given in this round, re-answers after going back included (E-32 position)
  drawnFor: Answer[] | null;       // the answers the current draw was asked for (S-04 back + the same answer = the same books)
  status: DrawStatus;
  drawId: number;                  // +1 for every draw request; late answers to older requests are ignored
  draw: DrawView | null;
  opened: boolean;
  index: number;                   // current bookmark (0-based)
  reactions: Reaction[];
  result: number;                  // S-06: which 궁금해요 book is shown (0-based)
  seen: string[];                  // books shown in this session — excluded from later draws (F-05)
}

export const INITIAL: FlowState = {
  step: "home", answers: [], asked: 0, drawnFor: null,
  status: "idle", drawId: 0, draw: null, opened: false, index: 0, reactions: [], result: 0, seen: [],
};

export type FlowAction =
  | { type: "start" }
  | { type: "answer"; choice: AnswerChoice }
  | { type: "back" }
  | { type: "drawn"; id: number; draw: DrawView }
  | { type: "drawFailed"; id: number }
  | { type: "retry" }
  | { type: "open" }
  | { type: "next" }
  | { type: "react"; reaction: Reaction }
  | { type: "leaveBack" }
  | { type: "nextResult" }
  | { type: "prevResult" }
  | { type: "redraw" }
  | { type: "home" };

/** Ask for a new draw for the current answers: to S-03 the first time, straight back to the open book after S-04 back. */
function requestDraw(s: FlowState): FlowState {
  return { ...s, status: "loading", drawId: s.drawId + 1, draw: null, drawnFor: s.answers, step: s.opened ? "first" : "book" };
}

/** The 궁금해요 books of this round, in bookmark order — S-06 shows them one by one. */
export function curiousPicks(s: Pick<FlowState, "draw" | "reactions">): PickView[] {
  return (s.draw?.picks ?? []).filter((_, i) => s.reactions[i] === "curious");
}

/**
 * v1.7: the draw's signed ticket and the pick's place in the draw — kept with an S-06 save made before logging in, so the
 * 도감 can record it after the login. Nothing when the draw was not signed or the pick is not from this draw.
 */
export function meetingOf(draw: DrawView | null, pick: PickView | undefined): FoundRequest | undefined {
  const ticket = draw?.ticket;
  const index = pick && draw ? draw.picks.indexOf(pick) : -1;
  if (!ticket?.sig || index < 0) return undefined;
  return { seed: ticket.seed, count: ticket.count, iat: ticket.iat, sub: ticket.sub, sig: ticket.sig, isbns: [...ticket.isbns], index };
}

const addSeen = (seen: string[], id: string) => (seen.includes(id) ? seen : [...seen, id]);

function answer(s: FlowState, choice: AnswerChoice): FlowState {
  if (s.step !== "questions") return s;
  const node = nextQuestion(s.answers);
  if (!node) return s;
  const answers = [...s.answers, { node: node.id, choice }];
  const moved = { ...s, answers, asked: s.asked + 1 };
  if (nextQuestion(answers) !== null) return moved;
  // the path is done. Back on the open book with the same answers (and a draw that did not fail): the same five books.
  if (s.opened && s.drawnFor && sameAnswers(answers, s.drawnFor) && s.status !== "error") return { ...moved, step: "first" };
  return requestDraw(moved);
}

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case "start":
      return { ...INITIAL, seen: s.seen, step: "questions" };
    case "answer":
      return answer(s, a.choice);
    case "back":
      // S-02 [← 이전 질문] and S-04 [← 질문으로 돌아가기] drop the last answer. The first question's back is Flow's [처음으로].
      if ((s.step === "questions" || s.step === "first") && s.answers.length > 0) {
        return { ...s, step: "questions", answers: s.answers.slice(0, -1) };
      }
      return s;
    case "drawn":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "ready", draw: a.draw } : s;
    case "drawFailed":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "error" } : s;
    case "retry":
      return s.status === "error" ? { ...s, status: "loading", drawId: s.drawId + 1 } : s;
    case "open":
      return s.step === "book" ? { ...s, opened: true, step: "first" } : s;
    case "next":
      if (s.step !== "first" || s.status !== "ready" || !s.draw || s.draw.picks.length === 0) return s;
      return { ...s, step: "bookmarks", index: 0, reactions: [], seen: addSeen(s.seen, s.draw.picks[0].card.id) };
    case "react": {
      if (s.step !== "bookmarks" || !s.draw) return s;
      const reactions = [...s.reactions, a.reaction];
      const index = s.index + 1;
      // F-27 (10-07): the book is closed and turned over — S-11 뒤표지 with the five bookmarks laid on it
      if (index >= s.draw.picks.length) return { ...s, reactions, result: 0, step: "back" };
      return { ...s, reactions, index, seen: addSeen(s.seen, s.draw.picks[index].card.id) };
    }
    case "leaveBack":
      // PRD 2절: S-06 when something was 궁금해요, straight to S-08 when nothing was
      if (s.step !== "back") return s;
      return { ...s, step: s.reactions.includes("curious") ? "result" : "end" };
    case "nextResult": {
      if (s.step !== "result") return s;
      const result = s.result + 1;
      return result < curiousPicks(s).length ? { ...s, result } : { ...s, step: "end" };
    }
    case "prevResult":
      return s.step === "result" && s.result > 0 ? { ...s, result: s.result - 1 } : s;
    case "redraw":
      // F-10: the same answers, five new books (seen stay excluded), the earlier 궁금해요 do not carry over; a new closed book.
      if (s.step !== "end") return s;
      return requestDraw({ ...s, opened: false, index: 0, reactions: [], result: 0 });
    case "home":
      return { ...INITIAL, seen: s.seen };
  }
}
