"use client";
import type { CSSProperties } from "react";
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

interface Props {
  books: readonly { card: BookCard; art: ArtCombo }[];
  label: ShareLabel;
  curious: number;
  shareUrl: string;
  onContinue: () => void;
  onShared: (method: ShareMethod) => void;
}

/**
 * S-11 (F-27, 사용자 시안 A 10-07): the book closed and turned over — the last page of the round. Today's bookmarks lie on
 * the back cover (the real C-02 bookmark, small and still: fx light), under them a paper label "내가 고른 길" with only the
 * choices all five match (lib/share/label — the server worked them out). The main button goes on (S-06, or S-08 with no
 * 궁금해요); [공유하기] and [이미지로 공유] are ShareActions (inside KakaoTalk: open
 * this back cover in the phone's browser instead). Shows only — Flow sends the events (E-41, E-42 through onShared).
 */
export function BackCover({ books, label, curious, shareUrl, onContinue, onShared }: Props) {
  return (
    <section className={styles.back} aria-labelledby="back-title">
      <h1 id="back-title" className={styles.title}>{BACK_TITLE}</h1>
      <BackBoard books={books} label={label} />
      <div className={styles.actions}>
        <Button onClick={onContinue}>{curious > 0 ? `궁금해요 ${curious}권 책 정보 보기` : NEXT_WHEN_NONE}</Button>
        <ShareActions shareUrl={shareUrl} count={books.length} variant="secondary" handOver onShared={onShared} />
      </div>
    </section>
  );
}

/**
 * The back board itself (C-29): leather, its spine on the right, today's bookmarks laid on it and the "내가 고른 길" label.
 * S-11 and the shared S-12 page draw the same board.
 */
export function BackBoard({ books, label }: Pick<Props, "books" | "label">) {
  const chips = [...(label.challenge ? [CHALLENGE_CHIP] : []), ...label.chips];
  return (
    <div className={styles.cover}>
      <span className={styles.spine} aria-hidden="true" />
      <span className={styles.stamp} aria-hidden="true" />
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
  );
}
