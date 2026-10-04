"use client";
import { useRef, type CSSProperties } from "react";
import type { ArtCombo } from "@/lib/art/combine";
import { toneOf } from "@/lib/books/taxonomy";
import { bookTitle } from "@/lib/books/title";
import type { BookCard } from "@/lib/books/types";
import { BookmarkArt } from "./BookmarkArt";
import { useFitTitle } from "./fitTitle";
import { GenreTag } from "./GenreTag";
import frame from "./BookmarkFrame.module.css";
import styles from "./Bookmark.module.css";

interface Props {
  card: BookCard;
  art: ArtCombo;
  moving?: boolean;
  /** 내 책갈피 only (DESIGN C-13, 10-04): the day it was kept, "2026. 10. 4." — shown as "… 만남" above the stitch line. */
  met?: string;
}

/**
 * C-02 (DESIGN 4절): frost film, arched window, name tag, title, author (PRD F-08), one-liner, stitch line, swallowtail, string.
 * The shape is shared with the balance cards (BookmarkFrame.module.css).
 */
export function Bookmark({ card, art, moving = false, met }: Props) {
  const tone = toneOf(card);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useFitTitle(titleRef, card.title);
  // Flows saved in sessionStorage before the author field existed have no author: leave the line and the label part out.
  return (
    <article
      className={`${frame.frame} ${styles.bookmark}`}
      data-moving={moving ? "" : undefined}
      aria-label={[card.title, card.author, card.oneLiner, card.genre, met && `${met} 만남`].filter(Boolean).join(", ")}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={frame.string} aria-hidden="true" />
      <div className={`${frame.film} ${styles.card}`} aria-hidden="true">
        <span className={frame.hole} />
        <div className={styles.window}><BookmarkArt art={art} clipId={`arch-${card.id}`} /></div>
        <GenreTag card={card} />
        <h3 ref={titleRef} className={styles.title} data-part="title">{bookTitle(card.title)}</h3>
        {card.author ? <p className={styles.author} data-part="author">{card.author}</p> : null}
        <span className={styles.gap} data-part="gap" />
        <p className={styles.line} data-part="line">{card.oneLiner}</p>
        {met ? <p className={styles.met} data-part="met">{`${met} 만남`}</p> : null}
        <span className={frame.stitch} />
        <span className={styles.mark}>갈피</span>
      </div>
    </article>
  );
}
