import type { CSSProperties } from "react";
import type { ArtCombo } from "@/lib/art/combine";
import { toneOf } from "@/lib/books/taxonomy";
import type { BookCard } from "@/lib/books/types";
import { BookmarkArt } from "./BookmarkArt";
import { GenreTag } from "./GenreTag";
import styles from "./Bookmark.module.css";

interface Props { card: BookCard; art: ArtCombo; moving?: boolean }

/**
 * C-02 (DESIGN 4절): frost film, arched window, name tag, title, one-liner, stitch line, swallowtail, string.
 * Never the Minumsa shape — no square card, no left vertical band, no two colour stripes.
 */
export function Bookmark({ card, art, moving = false }: Props) {
  const tone = toneOf(card);
  return (
    <article
      className={styles.bookmark}
      data-moving={moving ? "" : undefined}
      aria-label={`${card.title}, ${card.oneLiner}, ${card.genre}`}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={styles.string} aria-hidden="true" />
      <div className={styles.card} aria-hidden="true">
        <span className={styles.hole} />
        <div className={styles.window}><BookmarkArt art={art} clipId={`arch-${card.id}`} /></div>
        <GenreTag card={card} />
        <h3 className={styles.title}>{card.title}</h3>
        <p className={styles.line}>{card.oneLiner}</p>
        <span className={styles.stitch} />
        <span className={styles.mark}>갈피</span>
      </div>
    </article>
  );
}
