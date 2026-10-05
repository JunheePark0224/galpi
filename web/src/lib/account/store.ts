import { useSyncExternalStore } from "react";
import type { Provider } from "@/lib/auth/next";

/**
 * Who is here, for the browser (P5): the header's [로그인] / [내 책갈피 N], S-06 [내 책갈피에 저장], S-09.
 * unknown = not asked yet (server HTML and the first paint — nothing is shown), off = login not set up on this site,
 * out / in = from /api/me. id is the Supabase user id (for Amplitude only), never shown.
 */
export interface Account { status: "unknown" | "off" | "out" | "in"; id: string | null; count: number }
/** library (v1.7): S-09 로그인 전 내 책갈피 [로그인하고 지키기]. */
export type LoginSource = "save" | "header" | "library";

const UNKNOWN: Account = { status: "unknown", id: null, count: 0 };
let account: Account = UNKNOWN;
let sheet: { source: LoginSource } | null = null;
let asking: Promise<Account> | null = null;
/** /auth/callback's proof, from whichever /api/me answer carried it, until LoginReturn takes it (E-14 once). */
let justLoggedIn: { provider: Provider; first: boolean } | null = null;
/**
 * S-06 저장 per book in this page (lib/library/keep): saving → saved / failed; full = this browser already holds 100
 * (logged out); unkeepFailed = a press to take it out did not go through. Logged out, "saved" is the browser's list itself.
 */
export type KeepState = "saving" | "saved" | "failed" | "full" | "unkeepFailed";
let keeps: Readonly<Record<string, KeepState>> = {};
/** How many times S-06 said "saved" in this page — the header's +1 badge follows it. */
let kept = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const accountSnapshot = (): Account => account;
export const loginSheetSnapshot = (): { source: LoginSource } | null => sheet;
export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: Account): void {
  account = next;
  emit();
}

/** Asks /api/me once per page (force: again — after coming back from a login). A failed question counts as logged out. */
export function loadAccount(force = false): Promise<Account> {
  if (asking && !force) return asking;
  asking = (async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const me = (await res.json()) as { enabled?: unknown; loggedIn?: unknown; id?: unknown; count?: unknown; login?: unknown };
      const login = me.login as { provider?: unknown; first?: unknown } | null | undefined;
      if (login && (login.provider === "kakao" || login.provider === "google") && typeof login.first === "boolean") {
        justLoggedIn = { provider: login.provider, first: login.first };
      }
      if (me.enabled !== true) set({ status: "off", id: null, count: 0 });
      else if (me.loggedIn === true && typeof me.id === "string") {
        set({ status: "in", id: me.id, count: typeof me.count === "number" ? me.count : 0 });
      } else set({ status: "out", id: null, count: 0 });
    } catch {
      set({ status: "out", id: null, count: 0 });
    }
    return account;
  })();
  return asking;
}

/** The login that just finished, once: later calls get null. */
export function takeJustLoggedIn(): { provider: Provider; first: boolean } | null {
  const login = justLoggedIn;
  justLoggedIn = null;
  return login;
}

export function setSavedCount(count: number): void {
  if (account.status === "in") set({ ...account, count });
}

/** One more (or fewer) bookmark, counted on the latest state — not on a value a component read earlier. */
export function addSavedCount(delta: number): void {
  if (account.status === "in") set({ ...account, count: Math.max(0, account.count + delta) });
}

export function signedOut(): void {
  set({ status: "out", id: null, count: 0 });
}

/** S-07 (C-12): one sheet for the whole page, opened from the header, S-09 or (storage blocked) S-06 저장. */
export function openLoginSheet(source: LoginSource): void {
  sheet = { source };
  emit();
}

export function closeLoginSheet(): void {
  sheet = null;
  emit();
}

const unknown = () => UNKNOWN;
const closed = () => null;
export const useAccount = (): Account => useSyncExternalStore(subscribeAccount, accountSnapshot, unknown);
export const useLoginSheet = () => useSyncExternalStore(subscribeAccount, loginSheetSnapshot, closed);


export const keepSnapshot = (isbn: string): KeepState | undefined => keeps[isbn];

export function setKeepState(isbn: string, state: KeepState | null): void {
  const rest = Object.fromEntries(Object.entries(keeps).filter(([key]) => key !== isbn));
  keeps = state ? { ...rest, [isbn]: state } : rest;
  emit();
}

export const useKeepState = (isbn: string): KeepState | undefined =>
  useSyncExternalStore(subscribeAccount, () => keeps[isbn], () => undefined);

export const keptSnapshot = (): number => kept;

/** A bookmark just showed as saved on S-06: the header shows +1 for a moment (AccountButton). */
export function announceKept(): void {
  kept += 1;
  emit();
}

export const useKept = (): number => useSyncExternalStore(subscribeAccount, keptSnapshot, () => 0);
