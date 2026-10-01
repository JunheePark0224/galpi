"use client";
import { Button } from "@/components/Button";
import { useAccount, useKeepState } from "@/lib/account/store";
import { kstDate } from "@/lib/books/library";
import type { PickView } from "@/lib/flow/state";
import { pressKeep } from "@/lib/library/keep";
import styles from "./KeepButton.module.css";

/** New copy (DESIGN C-16, 시안 ①). */
export const KEEP = "내 책갈피에 꽂기";
export const KEEP_NOTE = "로그인하면 내 책갈피에 모여요";
export const KEPT = "꽂았어요 ✓";
export const KEEP_FAILED = "꽂지 못했어요. 다시 눌러 주세요.";

/**
 * S-06 under a pulled-out bookmark (PRD F-12): the main button. What happens is lib/library/keep — this shows the book's
 * keep state: saving, kept (+ a way to 내 책갈피), failed. Logged out it says why to log in. Hidden while nobody has
 * answered who is here, and when login is not set up on this site.
 */
export function KeepButton({ pick }: { pick: PickView }) {
  const account = useAccount();
  const state = useKeepState(pick.card.id);

  if (account.status === "off" || account.status === "unknown") return null;

  if (state === "saved") {
    return (
      <p className={styles.kept} role="status">
        {KEPT} · <a href="/library" className={styles.link}>내 책갈피 보기</a>
      </p>
    );
  }

  const press = () => pressKeep(
    { isbn: pick.card.id, art: pick.art, reason: pick.reason, metOn: kstDate(new Date()) },
    account.status === "in",
  );

  return (
    <div className={styles.keep}>
      <Button onClick={press} disabled={state === "saving"} className={styles.button}>{KEEP}</Button>
      {account.status === "out" && <p className={styles.note}>{KEEP_NOTE}</p>}
      {state === "failed" && <p role="alert" className={styles.error}>{KEEP_FAILED}</p>}
    </div>
  );
}
