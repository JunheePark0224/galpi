"use client";
import { useEffect, useId, useState } from "react";
import { useAccount, useKeepState, type KeepState } from "@/lib/account/store";
import { kstDate } from "@/lib/books/library";
import type { PickView } from "@/lib/flow/state";
import { useGuestSaves } from "@/lib/library/guest";
import { pressKeep, pressUnkeep } from "@/lib/library/keep";
import { KeepFlight, type FlightPath } from "./KeepFlight";
import styles from "./KeepButton.module.css";

/** Copy of C-16b (v1.7, 10-05 — plans/2026-10-05-guest-keep.md, wording B). */
export const KEEP = "내 책갈피에 저장";
export const KEEP_HINT = "나중에 다시 꺼내 볼 수 있어요";
export const KEPT = "내 책갈피에 저장했어요";
export const KEPT_HINT = "다시 누르면 빼요";
export const KEEP_FAILED = "저장하지 못했어요. 다시 눌러 주세요.";
export const KEEP_FULL = "임시 책갈피는 100개까지예요. 로그인하면 계속 모을 수 있어요";
/** New copy (context 10-05): a press to take it out that did not go through. */
export const UNKEEP_FAILED = "빼지 못했어요. 다시 눌러 주세요.";
export const SAVED_TOAST = "내 책갈피에 저장했어요";
export const TO_LIBRARY = "보러 가기 →";
const TOAST_MS = 4000;
const NOTES: Partial<Record<KeepState, string>> = { failed: KEEP_FAILED, full: KEEP_FULL, unkeepFailed: UNKEEP_FAILED };

/** Where the flying copy starts (the peeking bookmark on the cover) and lands (the header's 내 책갈피). */
function flightPath(): FlightPath | null {
  const from = document.querySelector("[data-pull]")?.getBoundingClientRect();
  const to = document.querySelector("[data-account]")?.getBoundingClientRect();
  if (!from || !to || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  return { from: { x: from.left, y: from.top }, to: { x: to.left + to.width / 2, y: to.top + to.height / 2 } };
}

/**
 * S-06 [🔖 내 책갈피에 저장] (PRD F-12, DESIGN C-16b v1.7): a wide leather button under the title and author, above
 * [예스24에서 보기] (still the one main button). Logged in or not, one press saves (lib/library/keep — logged out, into this
 * browser); then it turns green "✓ 내 책갈피에 저장했어요" and a second press takes it out (E-16). A new save flies a small
 * copy of the bookmark to the header (not with reduced motion), and a toast offers 내 책갈피 for 4 s. Hidden while nobody
 * has answered who is here, and when login is not set up on this site.
 */
export function KeepButton({ pick }: { pick: PickView }) {
  const account = useAccount();
  const state = useKeepState(pick.card.id);
  const guest = useGuestSaves();
  const hintId = useId();
  // the toast: 0 = hidden; each new save counts up, so a second save in a row shows it for 4 s again
  const [toast, setToast] = useState(0);
  const [flight, setFlight] = useState<FlightPath | null>(null);

  useEffect(() => {
    if (toast === 0) return;
    const timer = setTimeout(() => setToast(0), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (account.status === "off" || account.status === "unknown") return null;
  const loggedIn = account.status === "in";
  const isbn = pick.card.id;
  const saved = state === "unkeepFailed" || (loggedIn ? state === "saved" : guest.some((s) => s.isbn === isbn));

  const press = () => {
    if (saved) {
      void pressUnkeep(isbn, loggedIn);
      return;
    }
    const shown = pressKeep({ isbn, art: pick.art, reason: pick.reason, metOn: kstDate(new Date()), card: pick.card }, loggedIn);
    if (!shown) return;
    setFlight(flightPath());
    setToast((n) => n + 1);
  };

  const problem = state ? NOTES[state] : undefined;

  return (
    <div className={styles.keep}>
      <button
        type="button" className={styles.button} data-saved={saved ? "" : undefined} onClick={press}
        disabled={state === "saving"} aria-label={saved ? KEPT : KEEP} aria-describedby={hintId} data-part="keep"
      >
        <span className={styles.main}><span aria-hidden="true">{saved ? "✓" : "🔖"}</span> {saved ? KEPT : KEEP}</span>
        <span id={hintId} className={styles.hint}>{saved ? KEPT_HINT : KEEP_HINT}</span>
      </button>
      {problem && <p role="alert" className={styles.error}>{problem}</p>}
      {toast > 0 && (
        <p role="status" className={styles.toast}>
          {SAVED_TOAST} · <a href="/library" className={styles.toastLink}>{TO_LIBRARY}</a>
        </p>
      )}
      {flight && <KeepFlight pick={pick} path={flight} onDone={() => setFlight(null)} />}
    </div>
  );
}
