import { loginMarkAtLoad } from "@/lib/auth/next";
import { nextRound, setEntry } from "@/lib/track/common";
import { QUESTIONS } from "./questions";
import { INITIAL, STEPS, type FlowState } from "./state";

export const FLOW_KEY = "galpi.flow";
const VERSION = 5;   // 2 (P4): picks carry their reason, S-06 keeps its place; 3: 마음·회복 left the keyword list; 4 (F-24): goals carry
                     // `missing` and a goal with no topic draws nothing; 5 (10-02): 🍃 questions come in a shuffled `order` — an older saved flow
                     // starts over

/**
 * Resume only when the load is a reload or a history traversal, or the tab was discarded and restored (KakaoTalk's in-app
 * browser reloads often; Chrome discards background tabs). A fresh "navigate" (typed address, opened link, logo) starts at S-01.
 * Without navigation timing (`undefined`) resuming is the safe, old behaviour. Coming back from a login (/auth/callback
 * adds ?login=, P5) also resumes: the person returns to the book they were keeping, not to S-01.
 */
export function shouldResume(navType: string | undefined, wasDiscarded: boolean, fromLogin = false): boolean {
  return fromLogin || wasDiscarded || navType === undefined || navType === "reload" || navType === "back_forward";
}

/** A shuffle of the nine question indices, each once (lib/flow/order). */
const isOrder = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === QUESTIONS.length && [...v].sort((a, b) => a - b).every((q, k) => q === k);

function readSaved(): FlowState | null {
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { v?: unknown; state?: Partial<FlowState> };
    const state = saved.state;
    if (saved.v !== VERSION || !state || !STEPS.includes(state.step as FlowState["step"])) return null;
    if (!isOrder(state.order)) return null;   // a broken or edited question order: start over rather than ask the wrong question
    return { ...INITIAL, ...state } as FlowState;
  } catch {
    return null;
  }
}

/**
 * The flow to start from, given whether this load resumes. A request cut off by a reload becomes a retry. On a fresh open
 * the books already shown stay excluded, and a round that was in progress is left unfinished (no event: that is the
 * abandonment signal) so the next game is a new round with no entry chosen yet (taxonomy 3-1a). The fresh state is written back at once, so a repeated call
 * (React StrictMode runs reducer init twice in dev) sees "home" and does not move the round again.
 */
export function restoreFlow(resume: boolean): FlowState {
  const saved = readSaved();
  if (!saved) return INITIAL;
  if (resume) return saved.status === "loading" ? { ...saved, status: "error" } : saved;
  const fresh: FlowState = { ...INITIAL, seen: saved.seen };
  if (saved.step !== "home") {
    nextRound();
    setEntry(null);
  }
  saveFlow(fresh);
  return fresh;
}

let settled = false;

/**
 * The one decision of how this document opens, made once per document (later calls do nothing). The navigation type
 * describes the document load, so coming back to S-01 inside the same document (browser back from /privacy) resumes.
 * TrackVisit calls it before site_visited so that visit already carries the new round and no entry; loadFlow calls it
 * too, whichever comes first does the work.
 */
export function settleOpen(): void {
  if (settled) return;
  settled = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const discarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
    const fromLogin = loginMarkAtLoad() !== null;
    restoreFlow(shouldResume(nav?.type, discarded, fromLogin));
  } catch {
    // no navigation timing or storage: resuming (nothing to change) is the safe old behaviour
  }
}

/** Reducer init: the flow this document starts from. */
export function loadFlow(): FlowState {
  settleOpen();
  return restoreFlow(true);
}

export function saveFlow(state: FlowState): void {
  try {
    window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ v: VERSION, state }));
  } catch {
    // storage blocked: the flow still works, it just cannot resume after a reload
  }
}
