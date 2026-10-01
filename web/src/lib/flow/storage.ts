import { INITIAL, STEPS, type FlowState } from "./state";

export const FLOW_KEY = "galpi.flow";
const VERSION = 2;   // 2 (P4): picks carry their reason, S-06 keeps its place — an older saved flow starts over

/** Resume this tab's flow after a reload (KakaoTalk's in-app browser reloads often). A request cut off by the reload becomes a retry. */
export function loadFlow(): FlowState {
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as { v?: unknown; state?: Partial<FlowState> };
    const state = saved.state;
    if (saved.v !== VERSION || !state || !STEPS.includes(state.step as FlowState["step"])) return INITIAL;
    const full = { ...INITIAL, ...state } as FlowState;
    return full.status === "loading" ? { ...full, status: "error" } : full;
  } catch {
    return INITIAL;
  }
}

export function saveFlow(state: FlowState): void {
  try {
    window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ v: VERSION, state }));
  } catch {
    // storage blocked: the flow still works, it just cannot resume after a reload
  }
}
