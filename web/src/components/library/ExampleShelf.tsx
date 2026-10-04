import { BookmarkArt } from "@/components/BookmarkArt";
import type { ArtCombo } from "@/lib/art/combine";
import styles from "./ExampleShelf.module.css";

/** A made-up example: animals only, no titles — nobody's real shelf. */
const EXAMPLE: readonly { name: string; arts: ArtCombo[] }[] = [
  { name: "읽기 완료!", arts: [
    { animal: "cat", bg: "butter", sky: "cloud", ground: "flowers", rare: false },
    { animal: "duck", bg: "lavender", sky: "stars", ground: "none", rare: false },
    { animal: "fox", bg: "peach", sky: "stars", ground: "grass", rare: false },
    { animal: "bear", bg: "night", sky: "bigStar", ground: "grass", rare: false },
  ] },
  { name: "서점 가서 볼 책", arts: [
    { animal: "rabbit", bg: "butter", sky: "moon", ground: "grass", rare: false },
    { animal: "owl", bg: "night", sky: "cloud", ground: "mushroom", rare: false },
    { animal: "whale", bg: "sky", sky: "birds", ground: "none", rare: false },
  ] },
];

/**
 * A small made-up 내 책갈피 (two rods, animals only) — C-22 guide on S-09 and the S-07 login sheet (10-02: show what
 * keeping gives before asking to log in). Decorative: hidden from screen readers, the words around it say the same.
 */
export function ExampleShelf() {
  return (
    <div className={styles.example} aria-hidden="true">
      {EXAMPLE.map((rod, r) => (
        <div key={rod.name}>
          <p className={styles.rodName}>{rod.name} <span className={styles.pen}>✎</span></p>
          <div className={styles.rod} />
          <div className={styles.row}>
            {rod.arts.map((art, i) => (
              <span key={i} className={styles.mini}>
                <span className={styles.string} />
                <span className={styles.film}><BookmarkArt art={art} clipId={`example-${r}-${i}`} fx="light" /></span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
