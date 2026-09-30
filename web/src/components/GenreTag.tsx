import { toneOf } from "@/lib/books/taxonomy";
import type { BookCard } from "@/lib/books/types";
import styles from "./GenreTag.module.css";

/** C-04 — pill in the genre colour (🎯: field colour + topic name). */
export function GenreTag({ card }: { card: Pick<BookCard, "entry" | "genre" | "field"> }) {
  const tone = toneOf(card);
  return <span className={styles.tag} style={{ background: tone.bg, color: tone.fg }}>{card.genre}</span>;
}
