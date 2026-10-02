import styles from "./ResultLoading.module.css";

/**
 * Between screens before an S-06 book (10-02, user): a short wait while its cover arrives (≤ 3 s). It fades in only after
 * a moment, so a cover that is already there never flashes it.
 */
export function ResultLoading() {
  return (
    <div className={styles.wait} role="status">
      <span className={styles.book} aria-hidden="true" />
      <p className={styles.words}>책을 꺼내는 중…</p>
    </div>
  );
}
