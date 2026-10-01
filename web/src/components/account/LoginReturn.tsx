"use client";
import { useEffect, useState } from "react";
import { loadAccount } from "@/lib/account/store";
import { LOGIN_PARAMS, readLoginMark } from "@/lib/auth/next";
import { keepWaiting } from "@/lib/library/keep";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import { setUserId } from "@/lib/track/common";
import styles from "./LoginReturn.module.css";

const NOTICE_MS = 5000;

/** The login mark off the address (kept history state and hash), so a reload does not count the login twice. */
function clearMark(params: URLSearchParams): void {
  for (const key of LOGIN_PARAMS) params.delete(key);
  const query = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

/**
 * On every page (layout, after the page itself so flow restore has read the mark — storage.settleOpen): asks who is
 * here, names a logged-in person for Amplitude (taxonomy 3-2), and after /auth/callback sends E-14 once and keeps the
 * bookmark that waited for the login (F-12 자동 꽂기 — the page came back to that same book). A failed login gets a note.
 */
export function LoginReturn() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mark = readLoginMark(params);
    if (mark) clearMark(params);
    void loadAccount(mark !== null).then((account) => {
      if (account.status === "in" && account.id) {
        setUserId(account.id);
        setAmplitudeUser(account.id, mark?.provider ?? undefined);
      }
      if (!mark) return;
      if (mark.provider && account.status === "in") {
        track("login_completed", { provider: mark.provider, is_first_login: mark.first });
        void keepWaiting();
      } else {
        setFailed(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  return failed ? <p role="status" className={styles.notice}>로그인하지 못했어요. 다시 한 번 해 주세요.</p> : null;
}
