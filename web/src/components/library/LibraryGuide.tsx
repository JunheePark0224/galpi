"use client";
import { Button } from "@/components/Button";
import { BookmarkArt } from "@/components/BookmarkArt";
import { Sheet } from "@/components/Sheet";
import type { ArtCombo } from "@/lib/art/combine";
import styles from "./LibraryGuide.module.css";

/** Copy of C-22 (10-02, user: show how the rods can be used, with the rod names from the user's own shelf as the example). */
export const LIBRARY_GUIDE_TITLE = "내 책갈피, 이렇게 써 보세요";
export const LIBRARY_GUIDE_STEPS = [
  "＋ 막대 추가로 칸을 나눠요 (최대 5개)",
  "✎ 로 막대 이름을 정해요 — \"읽기 완료!\", \"서점 가서 볼 책\"처럼",
  "책갈피를 꾹 누르면 들려요 → 옮길 막대를 누르세요",
] as const;
export const LIBRARY_GUIDE_OK = "시작하기";

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

/** C-22: the first visit to S-09 opens this sheet once (per browser): a small example shelf, three lines, [시작하기]. */
export function LibraryGuide({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={LIBRARY_GUIDE_TITLE} onClose={onClose}>
      <div className={styles.example} aria-hidden="true">
        {EXAMPLE.map((rod, r) => (
          <div key={rod.name}>
            <p className={styles.rodName}>{rod.name} <span className={styles.pen}>✎</span></p>
            <div className={styles.rod} />
            <div className={styles.row}>
              {rod.arts.map((art, i) => (
                <span key={i} className={styles.mini}>
                  <span className={styles.string} />
                  <span className={styles.film}><BookmarkArt art={art} clipId={`guide-${r}-${i}`} /></span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ol className={styles.steps}>
        {LIBRARY_GUIDE_STEPS.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <Button className={styles.ok} onClick={onClose}>{LIBRARY_GUIDE_OK}</Button>
    </Sheet>
  );
}
