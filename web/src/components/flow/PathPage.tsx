import type { PathSummary } from "@/lib/paths";
import styles from "./FirstPage.module.css";

export const CHALLENGE_LINE = "평소의 당신과 반대편에서 골랐어요";
/** A challenge with no genre or topic chosen (a list rule, 19 · 36): nothing to turn around — a less familiar genre (10-09 시안 A-2). */
export const CHALLENGE_LINE_LIST = "오늘은 낯선 장르에서 골랐어요";
export const WHOLE_LIBRARY = "책장 전체에서";
export const MOOD_ANY = "기분은 갈피에게 맡겼어요";

/**
 * S-04 right page (DESIGN C-10 v2, design 10절): "당신이 고른 길" — the narrowing answers in order, then the mood
 * answers. No book count: a short scope is widened quietly. The challenge route gets one line on top, and under it the
 * far rule's moving reason (`reason`, question-map `why:` — 10-06), broken after "에서" into two short lines. `summary` is the
 * draw's `path`; null while the draw is on its way (only the notes show). The notes share one live region that is always
 * on the page, so a note that arrives with the draw is announced (a region added together with its text often is not).
 */
export function PathPage({ summary, notices, reason = null, listRule = false }: { summary: PathSummary | null; notices: readonly string[]; reason?: string | null; listRule?: boolean }) {
  return (
    <div className={styles.page}>
      {summary && (
        <>
          {summary.mode === "challenge" && <p className={styles.challenge}>{listRule ? CHALLENGE_LINE_LIST : CHALLENGE_LINE}</p>}
          {summary.mode === "challenge" && reason && <ChallengeReason text={reason} />}
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

/** "A에서 B로" as two lines (the break after "에서 "); a line without one (the list rules) stays one line. */
function ChallengeReason({ text }: { text: string }) {
  const at = text.indexOf("에서 ");
  return (
    <p className={styles.challengeReason} data-part="challenge-reason">
      {at < 0 ? text : <>{text.slice(0, at + 2)}<br />{text.slice(at + 3)}</>}
    </p>
  );
}
