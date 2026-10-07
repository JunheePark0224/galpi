"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { NO_CHIP_LINE, type ShareLabel } from "@/lib/share/label";
import styles from "./BackCover.module.css";
import { ShareActions, type ShareMethod } from "./ShareActions";

export const BACK_TITLE = "오늘 만난 책갈피";
export const LABEL_TITLE = "내가 고른 길";
export const CHALLENGE_CHIP = "오늘은 낯선 쪽으로 도전";
export const NEXT_WHEN_NONE = "다음 책갈피 만나기";
export { COPIED, COPY_FAILED, SHARE, type ShareMethod } from "./ShareActions";

/** Where each bookmark lies on the back cover (시안 A, 10-07: laid down by hand, a little askew) — left/top in %, turn in deg. */
const LAID: readonly (readonly [number, number, number])[] = [[4, 3, -8], [36, 0, 4], [67, 4, -3], [18, 37, 6], [51, 39, -6]];
/** The back cover is drawn at this size and scaled to the board it lies on (S-11: the shut book; S-12: a 320px board). */
const DESIGN_W = 320;
const DESIGN_H = 464;

type Books = readonly { card: BookCard; art: ArtCombo }[];

/** How much the 320 × 464 drawing must scale to fit the box it lies in. 1 until measured (and on the server). */
function useFit() {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setK(Math.min(width / DESIGN_W, height / DESIGN_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, k };
}

/**
 * What lies on the back cover (C-29): today's bookmarks (the real C-02 bookmark at 40%, still), a little askew, and the
 * paper label "내가 고른 길" with only the choices all five match (lib/share/label — the server worked them out).
 * Fills the box it is put in; S-11 puts it on the shut book's back (10-07), S-12 on BackBoard.
 */
export function BackLaid({ books, label }: { books: Books; label: ShareLabel }) {
  const chips = [...(label.challenge ? [CHALLENGE_CHIP] : []), ...label.chips];
  const { box, k } = useFit();
  return (
    <div ref={box} className={styles.fit}>
      <div className={styles.design} style={{ transform: `scale(${k})` }}>
        <ul className={styles.laid}>
          {books.map(({ card, art }, i) => {
            const [x, y, turn] = LAID[i % LAID.length];
            return (
              <li key={card.id} className={styles.slot} style={{ left: `${x}%`, top: `${y}%`, "--turn": `${turn}deg` } as CSSProperties}>
                <div className={styles.small}><Bookmark card={card} art={art} moving /></div>
              </li>
            );
          })}
        </ul>
        <div className={styles.label} role="group" aria-label={LABEL_TITLE}>
          <p className={styles.labelTitle} aria-hidden="true">{LABEL_TITLE}</p>
          {chips.length > 0
            ? <ul className={styles.chips}>{chips.map((c) => <li key={c} className={styles.chip}>{c}</li>)}</ul>
            : <p className={styles.none}>{NO_CHIP_LINE}</p>}
          <p className={styles.count}>{`이 길에서 만난 책갈피 ${books.length}장`}</p>
        </div>
      </div>
    </div>
  );
}

/** The back board on its own (S-12 shared page): leather, its spine on the right, a blind-stamped frame, BackLaid on it. */
export function BackBoard({ books, label }: { books: Books; label: ShareLabel }) {
  return (
    <div className={styles.cover}>
      <span className={styles.spine} aria-hidden="true" />
      <span className={styles.stamp} aria-hidden="true" />
      <BackLaid books={books} label={label} />
    </div>
  );
}

interface ActionsProps {
  count: number;
  curious: number;
  shareUrl: string;
  onContinue: () => void;
  onShared: (method: ShareMethod) => void;
}

/**
 * S-11 buttons under the shut book: the main button goes on (S-06, or S-08 with no 궁금해요); [공유하기] and
 * [이미지로 공유] are ShareActions (inside KakaoTalk: open this back cover in the phone's browser instead).
 * Shows only — Flow sends the events (E-42 through onShared).
 */
export function BackActions({ count, curious, shareUrl, onContinue, onShared }: ActionsProps) {
  return (
    <div className={styles.actions}>
      <Button onClick={onContinue}>{curious > 0 ? `궁금해요 ${curious}권 책 정보 보기` : NEXT_WHEN_NONE}</Button>
      <ShareActions shareUrl={shareUrl} count={count} variant="secondary" handOver onShared={onShared} />
    </div>
  );
}
