"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sheet } from "@/components/Sheet";
import { hasUnseenNews, latestWeek, markNewsSeen, NEWS_WEEKS, subscribeNews, weekLabel } from "@/lib/news/news";
import { track } from "@/lib/track/client";
import { OwlLetter } from "./OwlLetter";
import styles from "./NewsOwl.module.css";

const TITLE = "갈피 소식통";
const LINE = "이번 주에 바뀐 것";
/** Contains the visible words (WCAG 2.5.3). */
const LABEL = `${TITLE} — ${LINE}`;
/** 10-22 (user, mockup A `docs/mockups/2026-10-22-news-promise.html`): how books get onto the shelf, on top of every week. */
export const PROMISE = "갈피는 아무 책이나 꽂지 않아요. 기준표에 맞는 책만, 애매하면 사람이 확인해서 넣어요.";

/**
 * S-01 PRD F-28 / DESIGN C-33: the owl beside the 갈피 우체통 — the slot takes letters in, the owl brings news out. As quiet
 * as the slot. A small red dot when a week newer than the one last opened in this browser is up.
 */
export function NewsOwl() {
  const latest = latestWeek().start;
  const [open, setOpen] = useState(false);
  // The server cannot know this browser: no dot there and on hydration, then the browser's own answer.
  const unseen = useSyncExternalStore(subscribeNews, () => hasUnseenNews(latest), () => false);
  const [newOnOpen, setNewOnOpen] = useState(false);
  // The sheet focuses its first control — here the [닫기] under every week — which scrolls the sheet to the bottom.
  // This runs after the sheet's own focus (child effects first) and brings the newest week back into view. It relies on
  // Sheet's dialog being the scrolling box (Sheet.module.css .sheet); a Sheet option for the first focus would replace it.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = body.current?.closest<HTMLElement>("[role='dialog']");
    if (open && dialog) dialog.scrollTop = 0;
  }, [open]);

  const openSheet = () => {
    track("news_opened", { has_unseen: unseen, latest_week: latest });
    setNewOnOpen(unseen);
    markNewsSeen(latest);
    setOpen(true);
  };

  return (
    <div className={styles.post}>
      <button type="button" className={styles.owl} aria-label={unseen ? `${LABEL}, 새 소식 있음` : LABEL} onClick={openSheet}>
        <span className={styles.art}>
          <OwlLetter className={styles.drawing} />
          {unseen && <span className={styles.dot} data-testid="news-dot" aria-hidden="true" />}
        </span>
        <span className={styles.name} aria-hidden="true">{TITLE}</span>
        <span className={styles.line} aria-hidden="true">{LINE}</span>
      </button>
      {open && (
        <Sheet title={TITLE} onClose={() => setOpen(false)}>
          <div ref={body} className={styles.sheet}>
            <p className={styles.lead}>한 주 동안 갈피에서 바뀐 것을 모아 전해요.</p>
            <p className={styles.promise}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 2h12v20l-6-5-6 5z" fill="#b23a48" /></svg>
              {PROMISE}
            </p>
            {NEWS_WEEKS.map((week, i) => (
              <section key={week.start} className={styles.week}>
                <h3 className={styles.weekTitle}>
                  {weekLabel(week)}
                  {i === 0 && newOnOpen && <><span className={styles.srOnly}>, </span><span className={styles.new}>새 소식</span></>}
                </h3>
                <ul className={styles.items}>
                  {week.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
            <button type="button" className={styles.textClose} onClick={() => setOpen(false)}>닫기</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
