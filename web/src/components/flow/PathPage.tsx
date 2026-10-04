import type { PathSummary } from "@/lib/paths";
import styles from "./FirstPage.module.css";

export const CHALLENGE_LINE = "평소의 당신과 반대편에서 골랐어요";
export const WHOLE_LIBRARY = "책장 전체에서";
export const MOOD_ANY = "기분은 갈피에게 맡겼어요";

/**
 * S-04 right page (DESIGN C-10 v2, design 10절): "당신이 고른 길" — the narrowing answers in order, then the mood
 * answers. No book count: a short scope is widened quietly. The challenge route gets one line on top. `summary` is the
 * draw's `path`; null while the draw is on its way (only the notes show). The notes share one live region that is always
 * on the page, so a note that arrives with the draw is announced (a region added together with its text often is not).
 */
export function PathPage({ summary, notices }: { summary: PathSummary | null; notices: readonly string[] }) {
  return (
    <div className={styles.page}>
      {summary && (
        <>
          {summary.mode === "challenge" && <p className={styles.challenge}>{CHALLENGE_LINE}</p>}
          <section aria-labelledby="path-way">
            <h3 id="path-way" className={styles.label}>지나온 길</h3>
            <ol className={styles.rows}>
              {(summary.crumbs.length ? summary.crumbs : [WHOLE_LIBRARY]).map((c, i) => <li key={`${i}-${c}`} className={styles.row}>{c}</li>)}
            </ol>
          </section>
          <section aria-labelledby="path-mood">
            <h3 id="path-mood" className={styles.label}>기분</h3>
            <ul className={styles.rows}>
              {(summary.moods.length ? summary.moods : [MOOD_ANY]).map((m, i) => <li key={`${i}-${m}`} className={styles.row}>{m}</li>)}
            </ul>
          </section>
        </>
      )}
      <div className={styles.notes} role="status">
        {notices.map((n) => <p key={n} className={styles.note}>{n}</p>)}
      </div>
    </div>
  );
}
