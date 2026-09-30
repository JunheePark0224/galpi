import { Button } from "@/components/Button";
import { GenreTag } from "@/components/GenreTag";
import type { PickView, Reaction } from "@/lib/flow/state";
import styles from "./EndList.module.css";

interface Props { picks: readonly PickView[]; reactions: readonly Reaction[]; onHome: () => void }

/** P3 stand-in for S-06/S-08: the 궁금해요 books in order, then [처음으로]. S-06 proper (cover, intro, YES24) is P4. */
export function EndList({ picks, reactions, onHome }: Props) {
  const curious = picks.filter((_, i) => reactions[i] === "curious");
  return (
    <section className={styles.end}>
      {curious.length > 0 && (
        <>
          <h1 className={styles.title}>궁금해요 책</h1>
          <ul className={styles.list}>
            {curious.map((p) => (
              <li key={p.card.id} className={styles.item}>
                <GenreTag card={p.card} />
                <strong className={styles.bookTitle}>{p.card.title}</strong>
                <span className={styles.line}>{p.card.oneLiner}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button onClick={onHome}>처음으로</Button>
    </section>
  );
}
