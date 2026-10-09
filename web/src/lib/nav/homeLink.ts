import { useSyncExternalStore } from "react";

/**
 * The header's [처음으로] (10-09, D안 — mockups/2026-10-09-home-button-right.png). The header sits in the layout, the flow
 * on the page, so the flow hands its own home (E-20 source=header) here while it is away from S-01 and null at S-01.
 */
let flowHome: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The flow's home while away from S-01, null at S-01; returns the unregister (call it when the flow goes away). */
export function setFlowHome(home: (() => void) | null): () => void {
  flowHome = home;
  emit();
  return () => {
    if (flowHome !== home) return;
    flowHome = null;
    emit();
  };
}

/** Runs the flow's home; false when there is none (S-01, or no flow on this page). */
export function goFlowHome(): boolean {
  if (!flowHome) return false;
  flowHome();
  return true;
}

export const flowHomeSnapshot = (): boolean => flowHome !== null;
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const useFlowAway = (): boolean => useSyncExternalStore(subscribe, flowHomeSnapshot, () => false);

/** Tests only: start from nothing. */
export function forgetFlowHome(): void {
  flowHome = null;
  emit();
}
