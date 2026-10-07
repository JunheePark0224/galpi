"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { LogoMark } from "@/components/Logo";
import { FLIP_PAGE, OPEN_COVER, SHUT_BOOK } from "@/lib/motion";
import styles from "./Book.module.css";

interface Props {
  open: boolean;
  onPress?: () => void;   // S-03 only
  left?: ReactNode;       // inside of the cover once open
  right?: ReactNode;      // right-hand page
  tucked?: ReactNode;     // C-19: bookmark tips tucked into the closed book (CoverPeeks)
  /** S-11 (10-07): the round is over — the right-hand page shuts over the left, showing the back cover. */
  shut?: boolean;
  onShut?: () => void;
}

/**
 * C-01 — leather cover over a cream page (CSS 3D: perspective + backface), with a cloth rim around the open spread.
 * Closed, the cover is centred, lifted and zoomed by the scene (--cover-zoom, --cover-lift on the wrapper, a CSS transition
 * with the open-cover timing); on a phone the closed cover is a normal book (1 : 1.45) and the tall pages behind it stay
 * hidden until it opens. Opening swings the cover left around the spine (T-06) while the book settles to full size.
 * Transform and opacity only — no filter, no animated shadow. initial={false}: a resumed flow does not replay it.
 * `shut` (S-11, 10-07): the right half (back board + its page) turns over onto the left around the spine — the opening
 * reversed on the other side, so the back cover faces up — while the book slides to the middle; then onShut.
 */
export function Book({ open, onPress, left, right, tucked, shut = false, onShut }: Props) {
  return (
    <div className={styles.zoom} data-closed={open ? undefined : ""}>
      <motion.div
        className={styles.book}
        initial={false}
        animate={{ x: shut ? "25%" : open ? "0%" : "-25%" }}
        transition={shut ? SHUT_BOOK : OPEN_COVER}
      >
        <div className={styles.board} aria-hidden="true" data-under={shut ? "" : undefined} />
        <div className={styles.pageRight} data-under={shut ? "" : undefined}>{right}</div>
        {tucked}
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
            <span className={styles.spine} aria-hidden="true"><span className={styles.spineTitle}>갈피</span></span>
            <span className={styles.frame} aria-hidden="true">
              <span className={styles.plate}>
                <span className={styles.coverTitle}>갈피</span>
                <span className={styles.coverLine}>읽을 책, 갈피가 안 잡힐 때</span>
              </span>
              {/* C-01 tap cue (10-02, 5-friend test: "no sign to tap"): on the cover itself, in the foil mark's place, so a
                  browser bar over the bottom of the screen cannot hide it. The button's name stays "책 펼치기". */}
              {onPress && !open
                ? <span className={styles.tap}><span className={styles.tapHand}>👆</span> 눌러서 펼치기</span>
                : <LogoMark className={styles.coverMark} width={40} />}
            </span>
          </button>
          <div className={styles.back}><div className={styles.pageLeft}>{left}</div></div>
        </motion.div>
        {shut && (
          <motion.div
            className={styles.backHalf}
            data-shut=""
            aria-hidden="true"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -180 }}
            transition={SHUT_BOOK}
            onAnimationComplete={onShut}
          >
            <div className={styles.backInside}><div className={styles.backPage}><RuledPage /></div></div>
            <div className={styles.backOutside}><span className={styles.backStamp} /></div>
          </motion.div>
        )}
      </motion.div>
    </div>
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
