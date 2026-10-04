"use client";
import { useRef, type CSSProperties } from "react";
import { toneOf } from "@/lib/books/taxonomy";
import { bookTitle } from "@/lib/books/title";
import type { BookCard } from "@/lib/books/types";
import type { Reason } from "@/lib/recommend";
import { useFitTitle } from "./fitTitle";
import frame from "./BookmarkFrame.module.css";
import styles from "./BookmarkBack.module.css";

interface Props { card: BookCard; reason: Reason; met: string; moving?: boolean }

/**
 * The back of a C-02 bookmark (DESIGN C-13, first used by C-16 on S-06): the same 160 × 344 frame — title → a short
 * line in the genre colour → 나온 이유 (or 이 책은) and its items → 만난 날 → "갈피". All ink on the film (DESIGN 7).
 * A reason with no items (a 🍃 book with every axis 0) leaves its block out rather than a label over an empty list.
 */
export function BookmarkBack({ card, reason, met, moving = false }: Props) {
  const tone = toneOf(card);
  const titleRef = useRef<HTMLParagraphElement>(null);
  useFitTitle(titleRef, card.title);
  return (
    <article
      className={`${frame.frame} ${styles.back}`}
      data-moving={moving ? "" : undefined}
      aria-label={`${card.title} 책갈피 뒷면`}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={frame.string} aria-hidden="true" />
      <div className={`${frame.film} ${styles.card}`}>
        <span className={frame.hole} aria-hidden="true" />
        <p ref={titleRef} className={styles.title}>{bookTitle(card.title)}</p>
        {reason.items.length > 0 && (
          <>
            <span className={styles.rule} aria-hidden="true" />
            <p className={styles.label}>{reason.label}</p>
            <ul className={styles.items}>
              {reason.items.map((item, i) => <li key={`${i}-${item}`}><span aria-hidden="true" />{item}</li>)}
            </ul>
          </>
        )}
        <span className={styles.rule} aria-hidden="true" />
        <p className={styles.label}>만난 날</p>
        <p className={styles.met}>{met}</p>
        <span className={frame.stitch} aria-hidden="true" />
        <span className={styles.mark} aria-hidden="true">갈피</span>
      </div>
    </article>
  );
}
