import { LogoMark } from "@/components/Logo";
import type { BalanceChoice, Entry } from "@/lib/recommend";
import { lengthWord, targetSummary, tasteLines } from "@/lib/flow/summary";
import type { TargetForm } from "@/lib/flow/target";
import type { GoalMatch } from "@/lib/goal/match";
import styles from "./FirstPage.module.css";

interface Props {
  entry: Entry;
  choices: readonly BalanceChoice[];
  form: TargetForm;
  goal: GoalMatch | null;
  notices: readonly string[];
}

const DOTS = { 2: "●●", 1: "●○", 0: "○○" } as const;

/** S-04 left page (inside of the cover): the chapter title, like a book's first page. */
export function FirstPageTitle({ entry }: { entry: Entry }) {
  return (
    <div className={styles.titlePage}>
      <LogoMark className={styles.ornament} width={32} />
      <h2 className={styles.title}>당신이 찾는 책</h2>
      {entry === "leaf" && <p className={styles.caption}>당신의 책 취향</p>}
    </div>
  );
}

/**
 * S-04 right page (C-10) + honest notes (C-14). 🍃 shows the taste from the raw answers — never a type name.
 * A written goal (and a notice quoting it) is masked in Session Replay: the words stay in Supabase only (taxonomy 6-2).
 */
export function FirstPage({ entry, choices, form, goal, notices }: Props) {
  return (
    <div className={styles.page} data-amp-mask={goal ? true : undefined}>
      {entry === "leaf" ? (
        <ul className={styles.rows}>
          {tasteLines(choices).map((line) => (
            <li key={line.axis} className={styles.row}>
              <span>{line.text}</span>
              <span className={styles.dots} aria-hidden="true">{DOTS[line.strength]}</span>
            </li>
          ))}
          <li className={styles.row}><span>분량</span><span>{lengthWord(choices[8])}</span></li>
        </ul>
      ) : (
        <dl className={styles.rows}>
          {targetSummary(form, goal).map((r) => (
            <div key={r.label} className={styles.row}><dt>{r.label}</dt><dd>{r.value}</dd></div>
          ))}
        </dl>
      )}
      {notices.map((n) => <p key={n} className={styles.note} role="status">{n}</p>)}
    </div>
  );
}
