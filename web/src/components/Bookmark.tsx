import type { CSSProperties } from "react";
import type { ArtCombo } from "@/lib/art/combine";
import { toneOf } from "@/lib/books/taxonomy";
import type { BookCard } from "@/lib/books/types";
import { BookmarkArt } from "./BookmarkArt";
import { GenreTag } from "./GenreTag";
import frame from "./BookmarkFrame.module.css";
import styles from "./Bookmark.module.css";

interface Props { card: BookCard; art: ArtCombo; moving?: boolean }

/**
 * C-02 (DESIGN 4절): frost film, arched window, name tag, title, author (PRD F-08), one-liner, stitch line, swallowtail, string.
 * The shape is shared with the balance cards (BookmarkFrame.module.css).
 */
export function Bookmark({ card, art, moving = false }: Props) {
  const tone = toneOf(card);
  // Flows saved in sessionStorage before the author field existed have no author: leave the line and the label part out.
  return (
    <article
      className={`${frame.frame} ${styles.bookmark}`}
      data-moving={moving ? "" : undefined}
      aria-label={[card.title, card.author, card.oneLiner, card.genre].filter(Boolean).join(", ")}
      style={{ "--tone": tone.bg } as CSSProperties}
    >
      <span className={frame.string} aria-hidden="true" />
      <div className={`${frame.film} ${styles.card}`} aria-hidden="true">
        <span className={frame.hole} />
        <div className={styles.window}><BookmarkArt art={art} clipId={`arch-${card.id}`} /></div>
        <GenreTag card={card} />
        <h3 className={styles.title}>{card.title}</h3>
        {card.author ? <p className={styles.author}>{card.author}</p> : null}
        <p className={styles.line}>{card.oneLiner}</p>
        <span className={frame.stitch} />
        <span className={styles.mark}>갈피</span>
      </div>
    </article>
  );
}
