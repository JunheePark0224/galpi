import { Button } from "@/components/Button";
import { LogoMark } from "@/components/Logo";
import styles from "./EndScreen.module.css";

/** New copy (logged in context.md): the docs give S-08 its two buttons only. The second line says what 다시 뽑기 does (F-10). */
export const END_TITLE = "다음 책갈피를 만나 볼까요?";
export const END_NOTE = "다시 뽑으면 같은 조건으로, 아직 못 본 책 5권이 나와요";

interface Props { onRedraw: () => void; onHome: () => void }

/** S-08 (F-10): the book closes; [다시 뽑기] is the main way on, [처음으로] the other. */
export function EndScreen({ onRedraw, onHome }: Props) {
  return (
    <section className={styles.end} aria-labelledby="end-title">
      <div className={styles.book} aria-hidden="true">
        <span className={styles.spine} />
        <LogoMark className={styles.mark} width={40} />
      </div>
      <h1 id="end-title" className={styles.title}>{END_TITLE}</h1>
      <p className={styles.note}>{END_NOTE}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onHome}>처음으로</Button>
        <Button onClick={onRedraw}>다시 뽑기</Button>
      </div>
    </section>
  );
}
