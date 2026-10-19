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
