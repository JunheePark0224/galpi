import { nextRound } from "@/lib/track/common";
import { INITIAL, STEPS, type FlowState } from "./state";

export const FLOW_KEY = "galpi.flow";
const VERSION = 2;   // 2 (P4): picks carry their reason, S-06 keeps its place — an older saved flow starts over

/**
 * Resume only when the load is a reload or a history traversal, or the tab was discarded and restored (KakaoTalk's in-app
 * browser reloads often; Chrome discards background tabs). A fresh "navigate" (typed address, opened link, logo) starts at S-01.
 * Without navigation timing (`undefined`) resuming is the safe, old behaviour.
 */
export function shouldResume(navType: string | undefined, wasDiscarded: boolean): boolean {
  return wasDiscarded || navType === undefined || navType === "reload" || navType === "back_forward";
}

function readSaved(): FlowState | null {
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { v?: unknown; state?: Partial<FlowState> };
    const state = saved.state;
    if (saved.v !== VERSION || !state || !STEPS.includes(state.step as FlowState["step"])) return null;
    return { ...INITIAL, ...state } as FlowState;
  } catch {
    return null;
  }
}

/**
 * The flow to start from, given whether this load resumes. A request cut off by a reload becomes a retry. On a fresh open
 * the books already shown stay excluded, and a round that was in progress is left unfinished (no event: that is the
 * abandonment signal) so the next game is a new round. The fresh state is written back at once, so a repeated call
 * (React StrictMode runs reducer init twice in dev) sees "home" and does not move the round again.
 */
export function restoreFlow(resume: boolean): FlowState {
  const saved = readSaved();
  if (!saved) return INITIAL;
  if (resume) return saved.status === "loading" ? { ...saved, status: "error" } : saved;
  const fresh: FlowState = { ...INITIAL, seen: saved.seen };
  if (saved.step !== "home") nextRound();
  saveFlow(fresh);
  return fresh;
}

let decided = false;

/**
 * Reducer init. The navigation type describes the document load, so it is read once per document: coming back to S-01
 * inside the same document (browser back from /privacy) resumes.
 */
export function loadFlow(): FlowState {
  if (decided) return restoreFlow(true);
  decided = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const discarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
    return restoreFlow(shouldResume(nav?.type, discarded));
  } catch {
    return restoreFlow(true);
  }
}

export function saveFlow(state: FlowState): void {
  try {
    window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ v: VERSION, state }));
  } catch {
    // storage blocked: the flow still works, it just cannot resume after a reload
  }
}
