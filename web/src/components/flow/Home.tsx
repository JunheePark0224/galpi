import type { CSSProperties } from "react";
import type { Entry } from "@/lib/recommend";
import { LogoMark } from "@/components/Logo";
import styles from "./Home.module.css";

interface Props { onStart: (entry: Entry) => void }

/** PRD F-01 wording. */
const ENTRIES: readonly { entry: Entry; title: string; mark: string; desc: string }[] = [
  { entry: "target", title: "알고 싶은 게 있어요", mark: "🎯", desc: "배우고 싶은 주제로, 아직 모르는 책 만나기" },
  { entry: "leaf", title: "그냥 한 권 만나고 싶어요", mark: "🍃", desc: "밸런스 게임으로 내 취향에 맞는 한 권 만나기" },
];

/** P-01: a closed cloth book with two bookmarks peeking out. Decorative only, no words. */
function ShelfBook() {
  return (
    <div className={styles.shelf} aria-hidden="true">
      <span className={styles.peek} style={{ "--tone": "var(--genre-essay)" } as CSSProperties} />
      <span className={styles.peek} style={{ "--tone": "var(--genre-korean-fiction)" } as CSSProperties} />
      <span className={styles.cover}>
        <span className={styles.spine} />
        <LogoMark className={styles.mark} width={44} />
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
export function Home({ onStart }: Props) {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.logo}>갈피</h1>
        <p className={styles.tagline}>읽을 책, 갈피가 안 잡힐 때</p>
        <ShelfBook />
      </section>
      <div className={styles.entries}>
        {ENTRIES.map((e) => (
          <button key={e.entry} type="button" className={styles.entry} onClick={() => onStart(e.entry)}>
            <span className={styles.entryText}>
              <span className={styles.entryTitle}>{e.title} <span aria-hidden="true">{e.mark}</span></span>
              <span className={styles.entryDesc}>{e.desc}</span>
            </span>
            <span className={styles.go}><Arrow /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
