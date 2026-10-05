"use client";
import { useEffect, useState } from "react";
import { loadAccount, takeJustLoggedIn } from "@/lib/account/store";
import { LOGIN_PARAMS, loginMarkAtLoad } from "@/lib/auth/next";
import { mergeGuestSaves } from "@/lib/library/merge";
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
 * here and names the person for Amplitude (taxonomy 3-2 — or forgets them when nobody is logged in). After a real return
 * from /auth/callback — proven by the cookie /api/me hands over, not by the ?login= on the address — it sends E-14 once.
 * Whenever someone is logged in (v1.7), the bookmarks this browser kept before logging in move to the account
 * (lib/library/merge — any left over from a failed try go on the next visit). A failed login gets a note; the bookmarks
 * kept in this browser stay there.
 */
export function LoginReturn() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mark = loginMarkAtLoad();
    if (mark && new URLSearchParams(window.location.search).has("login")) clearMark(new URLSearchParams(window.location.search));
    void loadAccount(mark !== null).then((account) => {
      const login = takeJustLoggedIn();
      if (account.status === "in" && account.id) {
        setUserId(account.id);
        setAmplitudeUser(account.id, login?.provider);
      } else {
        setAmplitudeUser(null);
      }
      if (login && account.status === "in") track("login_completed", { provider: login.provider, is_first_login: login.first });
      if (account.status === "in") void mergeGuestSaves();
      else if (mark) setFailed(true);
    });
  }, []);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  return failed ? <p role="status" className={styles.notice}>로그인하지 못했어요. 다시 한 번 해 주세요.</p> : null;
}
