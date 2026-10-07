"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { ShareLabel } from "@/lib/share/label";
import { track } from "@/lib/track/client";
import { BackBoard } from "./BackCover";
import styles from "./BackCover.module.css";

export const SHARED_TITLE = "누군가 갈피에서 만난 책갈피";
export const SHARED_NOTE = "질문 몇 개면 나에게도 책갈피 다섯 장이 와요";
export const START_MINE = "나도 갈피 잡기";

interface Props { cards: BookCard[]; arts: ArtCombo[]; label: ShareLabel }

/**
 * S-12 (F-27): what a shared link opens — the same 뒤표지 board, and [나도 갈피 잡기] to S-01. E-43 once when it shows,
 * E-44 on the button. No sharer and no code in the events (taxonomy v2.0).
 */
export function SharedBack({ cards, arts, label }: Props) {
  const router = useRouter();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("share_page_viewed", { label_count: label.chips.length });
  }, [label.chips.length]);
  const start = () => {
    track("share_page_started", {});
    router.push("/");
  };
  return (
    <section className={styles.back} aria-labelledby="shared-title">
      <h1 id="shared-title" className={styles.title}>{SHARED_TITLE}</h1>
      <BackBoard books={cards.map((card, i) => ({ card, art: arts[i] }))} label={label} />
      <div className={styles.actions}>
        <Button onClick={start}>{START_MINE}</Button>
        <p className={styles.status}>{SHARED_NOTE}</p>
      </div>
    </section>
  );
}
