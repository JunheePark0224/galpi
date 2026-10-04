import type { CSSProperties } from "react";
import type { LibraryCount } from "@/lib/books/library";
import { LogoMark } from "@/components/Logo";
import { Mailbox } from "@/components/feedback/Mailbox";
import styles from "./Home.module.css";

/** library: F-23 count from the server (page.tsx), null until the first fill — then the cover keeps the logo. */
interface Props { onStart: () => void; library?: LibraryCount | null }

const books = (n: number) => `${n.toLocaleString("ko-KR")}권`;

/** PRD F-01 v2 wording (design 10절). */
export const START_LABEL = "갈피 잡으러 가기";
export const START_NOTE = "질문 몇 개면 한 권을 만나요";

/**
 * P-01: a closed cloth book with two bookmarks peeking out. Decorative — the words are read from Home's hidden line.
 * F-23 (시안 B): the count in gold foil on the cover, and on a day with new books one bookmark carries "+M".
 */
function ShelfBook({ library }: { library?: LibraryCount | null }) {
  const today = library?.today ?? 0;
  return (
    <div className={styles.shelf} aria-hidden="true" data-testid="shelf-book">
      <span className={styles.peek} style={{ "--tone": "var(--genre-essay)" } as CSSProperties} />
      {today > 0
        ? <span className={styles.newTag}>+{today.toLocaleString("ko-KR")}</span>
        : <span className={styles.peek} style={{ "--tone": "var(--genre-korean-fiction)" } as CSSProperties} />}
      <span className={styles.cover}>
        <span className={styles.spine} />
        {library
          ? <span className={styles.count}><span className={styles.countLabel}>갈피의 서재</span><span className={styles.countNum}>{library.total.toLocaleString("ko-KR")}<span className={styles.countUnit}>권</span></span></span>
          : <LogoMark className={styles.mark} width={44} />}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** S-01 — no login needed to start. The header above carries the small logo; no login place until P5. */
export function Home({ onStart, library = null }: Props) {
  const news = library && library.today > 0 ? `오늘 ${books(library.today)}이 새로 꽂혔어요` : null;
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.logo}>갈피</h1>
        <p className={styles.tagline}>읽을 책, 갈피가 안 잡힐 때</p>
        <ShelfBook library={library} />
        {library && <p className={styles.srOnly}>{[`갈피의 서재 ${books(library.total)}`, news].filter(Boolean).join(" · ")}</p>}
        {news && <p className={styles.news} aria-hidden="true">{news}</p>}
      </section>
      <div className={styles.entries}>
        <button type="button" className={styles.entry} onClick={onStart}>
          <span className={styles.entryTitle}>{START_LABEL}</span>
          <span className={styles.go}><Arrow /></span>
        </button>
        <p className={styles.entryNote}>{START_NOTE}</p>
      </div>
      <Mailbox />
    </div>
  );
}
