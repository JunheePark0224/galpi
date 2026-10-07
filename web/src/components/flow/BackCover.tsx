"use client";
import { useState, type CSSProperties } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { NO_CHIP_LINE, type ShareLabel } from "@/lib/share/label";
import styles from "./BackCover.module.css";

export const BACK_TITLE = "오늘 만난 책갈피";
export const LABEL_TITLE = "내가 고른 길";
export const CHALLENGE_CHIP = "오늘은 낯선 쪽으로 도전";
export const NEXT_WHEN_NONE = "다음 책갈피 만나기";
export const SHARE = "공유하기";
export const COPIED = "링크를 복사했어요";
export const COPY_FAILED = "링크를 복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요";
const shareText = (n: number) => `오늘 갈피에서 책갈피 ${n}장을 만났어요. 나도 갈피 잡으러 가기`;

export type ShareMethod = "native" | "copy" | "save_image";

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

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * S-11 (F-27, 사용자 시안 A 10-07): the book closed and turned over — the last page of the round. Today's bookmarks lie on
 * the back cover (the real C-02 bookmark, small and still: fx light), under them a paper label "내가 고른 길" with only the
 * choices all five match (lib/share/label — the server worked them out). The main button goes on (S-06, or S-08 with no
 * 궁금해요); [공유하기] opens the phone's share sheet with the link, or copies the link where there is none. The story image
 * (/s/<code>/story) can be saved too. Shows only — Flow sends the events (E-41, E-42 through onShared).
 */
export function BackCover({ books, label, curious, shareUrl, onContinue, onShared }: Props) {
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const story = `${new URL(shareUrl).pathname}/story`;

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "갈피", text: shareText(books.length), url: shareUrl });
        onShared("native");
      } catch (err) {
        if (!isAbort(err)) await copy();
      }
      return;
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("ok");
      onShared("copy");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <section className={styles.back} aria-labelledby="back-title">
      <h1 id="back-title" className={styles.title}>{BACK_TITLE}</h1>
      <BackBoard books={books} label={label} />
      <div className={styles.actions}>
        <Button onClick={onContinue}>{curious > 0 ? `궁금해요 ${curious}권 책 정보 보기` : NEXT_WHEN_NONE}</Button>
        <Button variant="secondary" onClick={() => { void share(); }}>
          <span aria-hidden="true">↗ </span>{SHARE}
        </Button>
        <p className={styles.status} role="status">{copied === "ok" ? COPIED : copied === "failed" ? COPY_FAILED : ""}</p>
        {copied === "failed" && (
          <input className={styles.link} aria-label="공유 링크" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
        )}
        <a className={styles.save} href={story} download="galpi-bookmarks.png" onClick={() => onShared("save_image")}>이미지 저장</a>
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
