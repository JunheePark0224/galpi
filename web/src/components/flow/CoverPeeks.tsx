"use client";
import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BACKGROUNDS } from "@/lib/art/combine";
import frame from "@/components/BookmarkFrame.module.css";
import styles from "./CoverPeeks.module.css";

/**
 * Fixed looks, in a fixed order — never from the draw (the five are met one by one once the book opens): string tones from
 * the genre palette, window tints from the A-02 skies (a plain wash — no animal, no props).
 */
const TONES = [
  "var(--genre-korean-fiction)", "var(--genre-science)", "var(--genre-art-travel)", "var(--genre-sf-fantasy)", "var(--genre-essay)",
] as const;
const TINTS = [BACKGROUNDS.peach.sky, BACKGROUNDS.sky.sky, BACKGROUNDS.butter.sky, BACKGROUNDS.lavender.sky, BACKGROUNDS.leaf.sky] as const;

type Cord = "stand" | "hang" | "drape";
/**
 * One tucked bookmark, in the bookmark's own units (C-02: 160 wide). x: % of the cover width. d: how deep in the book
 * (0 = right behind the front board, 1 = against the back board) — deeper pages meet the top of the block higher up.
 * rise: how much film stands above its page. tilt: degrees. cord: how its string lies. lean: which way it bends.
 */
interface Slot { x: number; d: number; rise: number; tilt: number; cord: Cord; lean: 1 | -1 }

/** Spread over the top, even but not regular — five, each clear of the next. */
const SPREAD: readonly Slot[] = [
  { x: 22, d: 0.7, rise: 176, tilt: -3, cord: "stand", lean: -1 },
  { x: 38, d: 0.2, rise: 236, tilt: 2, cord: "hang", lean: 1 },
  { x: 54, d: 0.85, rise: 158, tilt: -1.5, cord: "stand", lean: 1 },
  { x: 69, d: 0.1, rise: 206, tilt: 3.5, cord: "drape", lean: 1 },
  { x: 84, d: 0.5, rise: 188, tilt: 5.5, cord: "stand", lean: 1 },
];
/** Hole centre below the film top (BookmarkFrame: hole top 7 + radius 4). */
const HOLE = 11;   // the enlarged hole (CoverPeeks.module.css) keeps the same centre
const hole = (rise: number) => -rise + HOLE;

/** C-02's string: up out of the hole to its knot, a little bent. y = 0 is the slot line, up is negative. */
function standPath(rise: number, lean: 1 | -1): string {
  const h = hole(rise);
  return `M0 ${h} C ${lean} ${h - 14}, ${-lean} ${h - 24}, ${3 * lean} ${h - 34}`;
}
/** Out of the hole, slack down the front of the film into the pages. */
function hangPath(rise: number, lean: 1 | -1): string {
  const h = hole(rise);
  return `M0 ${h} C ${4 * lean} ${h + 50}, ${-14 * lean} ${h + 90}, ${-4 * lean} ${h + 130} S ${12 * lean} -30, ${8 * lean} 16`;
}
/** Over the top, towards the reader, over the top of the book and down the front cover to its knot. */
function drapePath(rise: number): string {
  const h = hole(rise);
  return `M0 ${h} C 0 ${h - 26}, 42 ${h - 34}, 66 ${h - 10} C 86 ${h + 12}, 92 -46, 98 10 C 102 60, 84 110, 96 170`;
}
const PATH: Record<Exclude<Cord, "drape">, (rise: number, lean: 1 | -1) => string> = { stand: standPath, hang: hangPath };
const knotOf = (slot: Slot) => (slot.cord === "stand" ? { cx: 3 * slot.lean, cy: hole(slot.rise) - 36 } : null);

/** String svg: 320 × 600 bookmark units around the slot point (slot at x 160, y 400). */
const VIEW = "-160 -400 320 600";

/** The rise: 0.42s each, 80ms apart, starting 0.1s after the cover — about 0.84s for all five. */
const RISE_S = 0.42;
const riseDelay = (i: number) => 0.1 + i * 0.08;

interface Props { open: boolean }

/**
 * C-19 — five of our bookmarks tucked into the closed book (S-03), drawn with the real C-02 frame (film, hole, string)
 * at a small scale. They rise out of their pages one after another when the cover appears (reduced motion: already in).
 * Decoration only: the window is a plain tint, nothing comes from the draw. Two layers inside the book:
 * `behind` (under the front cover: back board edge, page block top, the five bookmarks each cut off where its page meets
 * the top, the front board edge) and `over` (over the cover: the string that fell over the front). The cover button
 * stays the tap target.
 */
export function CoverPeeks({ open }: Props) {
  const reduced = useReducedMotion();
  const slots = SPREAD;
  // T-06-style rise, one after another; reduced motion → already in place. T-03: no frost blur while they move.
  const rise = !reduced;
  const [moving, setMoving] = useState(rise);
  const tips = slots.map((slot, i) => ({ slot, i, tone: TONES[i], tint: TINTS[i] }));
  // Deeper pages first, so a bookmark nearer the front cover is drawn over the ones behind it.
  const byDepth = [...tips].sort((a, b) => b.slot.d - a.slot.d);

  const vars = (slot: Slot, tone: string, tint?: string): CSSProperties => ({
    "--x": `${slot.x}%`, "--d": slot.d, "--tilt": `${slot.tilt}deg`, "--tone": tone, "--tint": tint,
  } as CSSProperties);

  return (
    <>
      <div className={styles.behind} data-cover-peeks="" data-open={open ? "" : undefined} aria-hidden="true">
        <span className={styles.backEdge} />
        <span className={styles.pages} />
        {byDepth.map(({ slot, i, tone, tint }) => {
          const knot = knotOf(slot);
          return (
            <div key={i} className={styles.slot} style={vars(slot, tone, tint)}>
              <span className={styles.gap} />
              <div className={styles.clip}>
                <div className={styles.tilt}>
                  <motion.div
                    className={styles.lift}
                    initial={rise ? { y: slot.rise + 60 } : false}
                    animate={{ y: 0 }}
                    transition={{ duration: RISE_S, delay: riseDelay(i), ease: [0.3, 0.9, 0.4, 1] }}
                    onAnimationComplete={i === slots.length - 1 ? () => setMoving(false) : undefined}
                  >
                    <div
                      className={`${frame.frame} ${styles.bookmark}`}
                      data-tip=""
                      data-moving={rise && moving ? "" : undefined}
                      style={{ top: -slot.rise - 26 }}
                    >
                      <span className={styles.shade} />
                      <div className={`${frame.film} ${styles.film}`}>
                        <span className={`${frame.hole} ${styles.hole}`} />
                        <span className={styles.wash} />
                      </div>
                    </div>
                    {slot.cord !== "drape" && (
                      <svg className={styles.cord} viewBox={VIEW} aria-hidden="true">
                        <path d={PATH[slot.cord](slot.rise, slot.lean)} />
                        {knot && <circle {...knot} r="7" className={styles.knot} />}
                      </svg>
                    )}
                  </motion.div>
                </div>
                <span className={styles.contact} />
              </div>
            </div>
          );
        })}
        <span className={styles.frontEdge} />
      </div>
      <div className={styles.over} data-cover-peeks="" data-open={open ? "" : undefined} aria-hidden="true">
        {tips.filter(({ slot }) => slot.cord === "drape").map(({ slot, i, tone }) => (
          <div key={i} className={styles.slot} style={vars(slot, tone)}>
            <div className={styles.tilt}>
              <motion.div
                className={styles.lift}
                initial={rise ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: riseDelay(i) + RISE_S * 0.6 }}
              >
                <svg className={styles.cord} viewBox={VIEW} aria-hidden="true">
                  <path className={styles.cordShadow} d={drapePath(slot.rise)} transform="translate(3 5)" />
                  <path d={drapePath(slot.rise)} />
                  <circle cx="96" cy="174" r="7" className={styles.knot} />
                </svg>
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
