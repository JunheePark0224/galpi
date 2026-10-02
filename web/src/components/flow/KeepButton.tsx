"use client";
import { useAccount, useKeepState } from "@/lib/account/store";
import { kstDate } from "@/lib/books/library";
import type { PickView } from "@/lib/flow/state";
import { pressKeep } from "@/lib/library/keep";
import styles from "./KeepButton.module.css";

/** New copy (DESIGN C-16b, 10-02 — the pill next to the title). The name says where it goes; the face says 꽂기. */
export const KEEP = "내 책갈피에 꽂기";
export const KEEP_FACE = "꽂기";
export const KEPT = "꽂았어요 ✓";
export const KEEP_FAILED = "꽂지 못했어요. 다시 눌러 주세요.";

/**
 * S-06 [🔖 꽂기] next to the title (PRD F-12, C-16b, 10-02): always there, one tap keeps — no need to pull the bookmark
 * out first. What happens is lib/library/keep (logged out: the S-07 login sheet, then the same book kept by itself). This
 * shows the book's keep state: saving, kept (+ a way to 내 책갈피), failed. A small ink pill with a 44px hit area; never
 * the screen's main button — that stays [예스24에서 보기]. Hidden while nobody has answered who is here, and when login is
 * not set up on this site.
 */
export function KeepButton({ pick }: { pick: PickView }) {
  const account = useAccount();
  const state = useKeepState(pick.card.id);

  if (account.status === "off" || account.status === "unknown") return null;

  if (state === "saved") {
    return (
      <p className={styles.kept} role="status" data-part="keep">
        {KEPT} · <a href="/library" className={styles.link}>내 책갈피 보기</a>
      </p>
    );
  }

  const press = () => pressKeep(
    { isbn: pick.card.id, art: pick.art, reason: pick.reason, metOn: kstDate(new Date()) },
    account.status === "in",
  );

  return (
    <>
      <button
        type="button" className={styles.pill} onClick={press} disabled={state === "saving"} aria-label={KEEP} data-part="keep"
      >
        <span className={styles.face}><span aria-hidden="true">🔖</span> {KEEP_FACE}</span>
      </button>
      {state === "failed" && <p role="alert" className={styles.error}>{KEEP_FAILED}</p>}
    </>
  );
}
