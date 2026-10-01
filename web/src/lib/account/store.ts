import { useSyncExternalStore } from "react";
import type { Provider } from "@/lib/auth/next";

/**
 * Who is here, for the browser (P5): the header's [로그인] / [내 책갈피 N], S-06 [내 책갈피에 꽂기], S-09.
 * unknown = not asked yet (server HTML and the first paint — nothing is shown), off = login not set up on this site,
 * out / in = from /api/me. id is the Supabase user id (for Amplitude only), never shown.
 */
export interface Account { status: "unknown" | "off" | "out" | "in"; id: string | null; count: number }
export type LoginSource = "save" | "header";

const UNKNOWN: Account = { status: "unknown", id: null, count: 0 };
let account: Account = UNKNOWN;
let sheet: { source: LoginSource } | null = null;
let asking: Promise<Account> | null = null;
let returned: Provider | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const accountSnapshot = (): Account => account;
export const loginSheetSnapshot = (): { source: LoginSource } | null => sheet;
/** Set once when this page came back from a successful login (LoginReturn) — S-06 then keeps the waiting bookmark. */
export const loginReturnSnapshot = (): Provider | null => returned;
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
      const me = (await res.json()) as { enabled?: unknown; loggedIn?: unknown; id?: unknown; count?: unknown };
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

export function setSavedCount(count: number): void {
  if (account.status === "in") set({ ...account, count });
}

export function signedOut(): void {
  set({ status: "out", id: null, count: 0 });
}

/** S-07 (C-12): one sheet for the whole page, opened from the header or from 꽂기. */
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

export function markLoginReturned(provider: Provider): void {
  returned = provider;
  emit();
}

/** The waiting 꽂기 was handled: the next render no longer sees a fresh login. */
export function consumeLoginReturn(): void {
  returned = null;
  emit();
}

export const useLoginReturn = (): Provider | null => useSyncExternalStore(subscribeAccount, loginReturnSnapshot, closed);

