"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { NO_CHIP_LINE, type ShareLabel } from "@/lib/share/label";
import { storyFile } from "@/lib/share/storyFile";
import styles from "./BackCover.module.css";
import { ShareSheet, type ShareMethod } from "./ShareSheet";

export const BACK_TITLE = "오늘 만난 책갈피";
export const LABEL_TITLE = "내가 고른 길";
export const CHALLENGE_CHIP = "오늘은 낯선 쪽으로 도전";
export const NEXT_WHEN_NONE = "다음 책갈피 만나기";
export const SHARE = "결과 공유하기";
/** B (back-cover experiment, 10-12): the line that says the lit bookmarks open. */
export const PICK_HINT = "책갈피를 눌러 보세요";
/** B: the tip on the first lit bookmark, until one is pressed (once per browser, lib/flow/firstGuide). */
export const PICK_TIP = "눌러서 책 정보 보기";
export type { ShareMethod } from "./ShareSheet";

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
/** B: the 궁금해요 bookmarks are lit and open their book; the rest are dimmed (S-11 only — the shared page never picks). */
export interface BackPick { ids: ReadonlySet<string>; onPick: (id: string) => void; showTip?: boolean }

export function BackLaid({ books, label, pick }: { books: Books; label: ShareLabel; pick?: BackPick }) {
  const chips = [...(label.challenge ? [CHALLENGE_CHIP] : []), ...label.chips];
  const { box, k } = useFit();
  const tipAt = pick?.showTip ? books.findIndex(({ card }) => pick.ids.has(card.id)) : -1;
  return (
    <div ref={box} className={styles.fit}>
      <div className={styles.design} style={{ transform: `scale(${k})` }}>
        <ul className={styles.laid} data-pick={pick ? "" : undefined}>
          {books.map(({ card, art }, i) => {
            const [x, y, turn] = LAID[i % LAID.length];
            return (
              <li key={card.id} className={`${styles.slot} ${pick ? (pick.ids.has(card.id) ? styles.lit : styles.dim) : ""}`}
                data-tip={i === tipAt ? "" : undefined}
                style={{ left: `${x}%`, top: `${y}%`, "--turn": `${turn}deg`, "--delay": `${i * 0.3}s` } as CSSProperties}>
                <div className={styles.small}><Bookmark card={card} art={art} moving /></div>
                {pick?.ids.has(card.id) && (
                  <button type="button" className={styles.pick} onClick={() => pick.onPick(card.id)} aria-label={`『${card.title}』 책 정보 보기`} />
                )}
                {i === tipAt && (
                  <p className={styles.tip} data-side={x < 20 ? "start" : x > 60 ? "end" : "middle"} aria-hidden="true">
                    <svg className={styles.tipIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-2a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2h.208a6 6 0 0 1-5.012-2.7L7 19c-.312-.479-1.407-2.388-3.286-5.728a1.5 1.5 0 0 1 .536-2.022a1.867 1.867 0 0 1 2.28.28L8 13" /></svg>
                    {PICK_TIP}
                  </p>
                )}
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
  /** B: the line that says the lit bookmarks open — it takes the main button's place (the bookmarks are the way on) */
  hint?: string;
  count: number;
  curious: number;
  shareUrl: string;
  onContinue: () => void;
  onShared: (method: ShareMethod, isLinkCopied: boolean | null) => void;
}

/**
 * S-11 buttons under the shut book: the main button goes on (S-06, or S-08 with no 궁금해요); [↗ 결과 공유하기] opens the
 * share sheet (C-31). Shows only — Flow sends the events (E-42 through onShared). The story picture is asked for (Flow
 * already did, at the last reaction; here for a resumed round) so the sheet's preview and [인스타 스토리로] are ready (10-08).
 */
export function BackActions({ hint, count, curious, shareUrl, onContinue, onShared }: ActionsProps) {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    void storyFile(`${new URL(shareUrl).pathname}/story`);
  }, [shareUrl]);
  const opener = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setSheet(false);
    opener.current?.focus();   // back to [결과 공유하기]
  }, []);
  return (
    <div className={styles.actions}>
      {hint && <p className={styles.hint}>{hint}</p>}
      {!hint && <Button onClick={onContinue}>{curious > 0 ? `궁금해요 ${curious}권 책 정보 보기` : NEXT_WHEN_NONE}</Button>}
      <Button ref={opener} variant="secondary" onClick={() => setSheet(true)} aria-haspopup="dialog">
        <span aria-hidden="true">↗ </span>{SHARE}
      </Button>
      {sheet && <ShareSheet shareUrl={shareUrl} count={count} onClose={close} onShared={onShared} />}
    </div>
  );
}
