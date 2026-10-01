"use client";
import { useEffect } from "react";
import { loadAccount, openLoginSheet, useAccount } from "@/lib/account/store";
import styles from "./AccountButton.module.css";

/**
 * Header top right (PRD F-11·F-13, DESIGN S-09 row): [로그인] opens S-07; logged in it is [내 책갈피 N] → /library.
 * Nothing until /api/me answers (and nothing at all when login is not set up), so no button flashes the wrong state.
 */
export function AccountButton() {
  const account = useAccount();
  useEffect(() => { void loadAccount(); }, []);

  if (account.status === "in") {
    return (
      <a href="/library" className={styles.account} aria-label={`내 책갈피 ${account.count}개`}>
        <span className={styles.label}>내 책갈피</span> <span aria-hidden="true">{account.count}</span>
      </a>
    );
  }
  if (account.status === "out") {
    return (
      <button type="button" className={styles.account} onClick={() => openLoginSheet("header")}>
        <span className={styles.label}>로그인</span>
      </button>
    );
  }
  return <span className={styles.slot} aria-hidden="true" />;
}
