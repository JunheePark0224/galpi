"use client";
import { useEffect, useState } from "react";
import { loadAccount, openLoginSheet, useAccount, useKept } from "@/lib/account/store";
import { useGuestSaves } from "@/lib/library/guest";
import styles from "./AccountButton.module.css";

/** The +1 waits for the S-06 copy to land (KeepFlight, about 600 ms), then stays 1.5 s. */
const LAND_MS = 600;
const BADGE_MS = 1500;

/** "+1" by the number for a moment after each S-06 save (v1.7). Decoration: the S-06 toast says it in words. */
function usePlusOne(): boolean {
  const kept = useKept();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (kept === 0) return;
    const land = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : LAND_MS;
    const show = setTimeout(() => setShown(true), land);
    const hide = setTimeout(() => setShown(false), land + BADGE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [kept]);
  return shown;
}

/**
 * Header top right (PRD F-11·F-13, DESIGN S-09 row): [로그인] opens S-07; logged in it is [내 책갈피 N] → /library — and
 * since v1.7 logged out too, once this browser keeps a bookmark (N = those). `data-account` is where S-06's flying copy
 * lands. Nothing until /api/me answers (and nothing at all when login is not set up), so no button flashes the wrong state.
 */
export function AccountButton() {
  const account = useAccount();
  const guest = useGuestSaves();
  const plusOne = usePlusOne();
  useEffect(() => { void loadAccount(); }, []);

  const count = account.status === "in" ? account.count : account.status === "out" && guest.length > 0 ? guest.length : null;
  if (count !== null) {
    return (
      <a href="/library" className={styles.account} aria-label={`내 책갈피 ${count}개`} data-account="">
        <span className={styles.label}>내 책갈피</span> <span aria-hidden="true">{count}</span>
        {plusOne && <span className={styles.plus} aria-hidden="true">+1</span>}
      </a>
    );
  }
  if (account.status === "out") {
    return (
      <button type="button" className={styles.account} onClick={() => openLoginSheet("header")} data-account="">
        <span className={styles.label}>로그인</span>
      </button>
    );
  }
  return <span className={styles.slot} aria-hidden="true" />;
}
