"use client";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { closeLoginSheet, useLoginSheet, type LoginSource } from "@/lib/account/store";
import { startLogin } from "@/lib/auth/browser";
import type { Provider } from "@/lib/auth/next";
import { clearPending } from "@/lib/library/pending";
import { track } from "@/lib/track/client";
import styles from "./LoginSheet.module.css";

const TITLE: Record<LoginSource, string> = {
  save: "내 책갈피에 꽂으려면 로그인해 주세요",
  header: "로그인하고 내 책갈피를 모아 보세요",
};

function KakaoMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.77 1.86 5.2 4.66 6.58l-.95 3.48c-.08.3.26.54.52.37l4.13-2.73c.53.06 1.08.1 1.64.1 5.52 0 10-3.48 10-7.8C22 6.48 17.52 3 12 3z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/**
 * S-07 (DESIGN C-12, 시안 ②): a sheet from the bottom — Kakao on top, Google below (PRD F-11), the privacy link
 * (PHASES P5 완료 기준). Opening it sends E-12, a provider button E-13 just before leaving. The login comes back to this
 * very page (/auth/callback ?next=), so S-06 returns to the same book.
 */
export function LoginSheet() {
  const sheet = useLoginSheet();
  const source = sheet?.source ?? null;
  return source ? <LoginChoices key={source} source={source} /> : null;
}

/** The open sheet: E-12 once when it appears; its state starts fresh every time it opens. */
function LoginChoices({ source }: { source: LoginSource }) {
  const [leaving, setLeaving] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { track("login_prompt_shown", { source }); }, [source]);

  // Closed without logging in: the bookmark that waited for this login is let go, so a later login from the header
  // does not keep a book the person walked away from.
  const close = () => {
    if (source === "save") clearPending();
    closeLoginSheet();
  };

  const login = async (provider: Provider) => {
    setFailed(false);
    setLeaving(provider);
    track("login_started", { provider });
    const started = await startLogin(provider, window.location.pathname + window.location.search);
    if (!started) {
      setLeaving(null);
      setFailed(true);
    }
  };

  return (
    <Sheet title={TITLE[source]} onClose={close}>
      <p className={styles.lead}>
        이름·연락처는 받지 않아요. 구글은 로그인 확인용 이메일만 로그인 서비스에 남아요. 처음 로그인한 방법으로 다시 들어와 주세요.
      </p>
      <button type="button" className={`${styles.provider} ${styles.kakao}`} disabled={leaving !== null} onClick={() => void login("kakao")}>
        <KakaoMark />카카오로 계속하기
      </button>
      <button type="button" className={`${styles.provider} ${styles.google}`} disabled={leaving !== null} onClick={() => void login("google")}>
        <GoogleMark />Google로 계속하기
      </button>
      {failed && <p role="alert" className={styles.error}>로그인을 시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.</p>}
      <div className={styles.foot}>
        <a href="/privacy" target="_blank" rel="noopener" className={styles.link}>개인정보 처리방침</a>
        <span aria-hidden="true"> · </span>
        <button type="button" className={styles.close} onClick={close}>닫기</button>
      </div>
    </Sheet>
  );
}
