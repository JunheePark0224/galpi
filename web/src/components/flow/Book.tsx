"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { FLIP_PAGE, OPEN_COVER } from "@/lib/motion";
import styles from "./Book.module.css";

interface Props {
  open: boolean;
  onPress?: () => void;   // S-03 only
  left?: ReactNode;       // inside of the cover once open
  right?: ReactNode;      // right-hand page
}

/**
 * C-01 — cloth cover over a cream page (CSS 3D: perspective + backface). Closed, the cover is centred;
 * opening swings it left around the spine (T-06 open-cover). initial={false}: a resumed flow does not replay it.
 */
export function Book({ open, onPress, left, right }: Props) {
  return (
    <motion.div className={styles.book} initial={false} animate={{ x: open ? "0%" : "-25%" }} transition={OPEN_COVER}>
      <div className={styles.pageRight}>{right}</div>
      <motion.div className={styles.cover} initial={false} animate={{ rotateY: open ? -180 : 0 }} transition={OPEN_COVER}>
        <button
          type="button"
          className={styles.front}
          onClick={onPress}
          disabled={!onPress}
          aria-label="책 펼치기"
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : undefined}
        >
          <span className={styles.coverTitle}>갈피</span>
        </button>
        <div className={styles.back}>{left}</div>
      </motion.div>
    </motion.div>
  );
}

/** Lined paper. Each new `turn` (> 0) flips one sheet over the page once (T-06 flip-page). */
export function RuledPage({ turn = 0 }: { turn?: number }) {
  return (
    <div className={styles.ruled}>
      {turn > 0 && (
        <motion.div
          key={turn}
          className={styles.sheet}
          aria-hidden="true"
          initial={{ rotateY: 0, opacity: 1 }}
          animate={{ rotateY: -180, opacity: 0 }}
          transition={FLIP_PAGE}
        />
      )}
    </div>
  );
}
