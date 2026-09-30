import type { Entry } from "@/lib/recommend";
import styles from "./Home.module.css";

interface Props { onStart: (entry: Entry) => void }

/** PRD F-01 wording. */
const ENTRIES: readonly { entry: Entry; title: string; mark: string; desc: string }[] = [
  { entry: "target", title: "알고 싶은 게 있어요", mark: "🎯", desc: "배우고 싶은 주제로, 아직 모르는 책 만나기" },
  { entry: "leaf", title: "그냥 한 권 만나고 싶어요", mark: "🍃", desc: "밸런스 게임으로 내 취향에 맞는 한 권 만나기" },
];

/** S-01 — no login needed to start. */
export function Home({ onStart }: Props) {
  return (
    <div className={styles.home}>
      <header className={styles.top}>
        {/* Top right: [로그인] / [내 서재] arrive in P5. Only the place is kept now. */}
        <span className={styles.accountSlot} aria-hidden="true" data-testid="account-slot" />
      </header>
      <section className={styles.hero}>
        <h1 className={styles.logo}>갈피</h1>
        <p className={styles.tagline}>읽을 책, 갈피가 안 잡힐 때</p>
      </section>
      <div className={styles.entries}>
        {ENTRIES.map((e) => (
          <button key={e.entry} type="button" className={styles.entry} onClick={() => onStart(e.entry)}>
            <span className={styles.entryTitle}>{e.title} <span aria-hidden="true">{e.mark}</span></span>
            <span className={styles.entryDesc}>{e.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
