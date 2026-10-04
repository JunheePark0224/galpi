"use client";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { ExampleShelf } from "./ExampleShelf";
import styles from "./LibraryGuide.module.css";

/** Copy of C-22 (10-02, user: show how the rods can be used, with the rod names from the user's own shelf as the example; third line 10-04 — move mode). */
export const LIBRARY_GUIDE_TITLE = "내 책갈피, 이렇게 써 보세요";
export const LIBRARY_GUIDE_STEPS = [
  "＋ 막대 추가로 칸을 나눠요 (최대 5개)",
  "✎ 로 막대 이름을 정해요 — \"읽기 완료!\", \"서점 가서 볼 책\"처럼",
  "[책갈피 옮기기]를 누르고 끌어서 원하는 자리에 놓아요",
] as const;
export const LIBRARY_GUIDE_OK = "시작하기";

/** C-22: the first visit to S-09 opens this sheet once (per browser): a small example shelf, three lines, [시작하기]. */
export function LibraryGuide({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={LIBRARY_GUIDE_TITLE} onClose={onClose}>
      <ExampleShelf />
      <ol className={styles.steps}>
        {LIBRARY_GUIDE_STEPS.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <Button className={styles.ok} onClick={onClose}>{LIBRARY_GUIDE_OK}</Button>
    </Sheet>
  );
}
