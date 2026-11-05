import { SHELF_NAME_MAX } from "@/lib/library/validate";
import styles from "./Library.module.css";

/**
 * C-17 (11-05, user): under a rod name being written — "n/16" while there is room, and once the name is full the limit
 * in words, so a key that does nothing more is explained. Characters as the server counts them (an emoji is one).
 * Polite live region: read when it changes to the full note, not on every key.
 */
export function NameCount({ value }: { value: string }) {
  const used = [...value].length;
  const full = used >= SHELF_NAME_MAX;
  return (
    <p className={styles.nameCount} aria-live="polite" data-full={full ? "" : undefined}>
      {full ? `막대 이름은 ${SHELF_NAME_MAX}자까지 쓸 수 있어요` : <span aria-hidden="true">{`${used}/${SHELF_NAME_MAX}`}</span>}
    </p>
  );
}
