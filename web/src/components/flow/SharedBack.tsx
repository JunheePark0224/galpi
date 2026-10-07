"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { ShareLabel } from "@/lib/share/label";
import { track } from "@/lib/track/client";
import { BACK_TITLE, BackBoard } from "./BackCover";
import { ShareActions, type ShareMethod } from "./ShareActions";
import styles from "./BackCover.module.css";

export const SHARED_TITLE = "누군가 갈피에서 만난 책갈피";
export const SHARED_NOTE = "질문 몇 개면 나에게도 책갈피 다섯 장이 와요";
export const START_MINE = "나도 갈피 잡기";

interface Props {
  code: string;
  cards: BookCard[];
  arts: ArtCombo[];
  label: ShareLabel;
  /** `?mine=1`: the person's own back cover, handed over from KakaoTalk to the phone's browser to share from there. */
  mine: boolean;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.galpibook.com";
const noSubscribe = () => () => {};

/**
 * S-12 (F-27): what a shared link opens — the same 뒤표지 board, and [나도 갈피 잡기] to S-01. E-43 once when it shows,
 * E-44 on the button. No sharer and no code in the events (taxonomy v2.0). With `mine` it is the sharer's own S-11 board
 * opened outside KakaoTalk (10-07): its title, [공유하기] as the main button and E-42 — not a visit, so no E-43.
 */
export function SharedBack({ code, cards, arts, label, mine }: Props) {
  const router = useRouter();
  const sent = useRef(false);
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => SITE);
  useEffect(() => {
    if (mine || sent.current) return;
    sent.current = true;
    track("share_page_viewed", { label_count: label.chips.length });
  }, [mine, label.chips.length]);
  const start = () => {
    track("share_page_started", {});
    router.push("/");
  };
  const shared = (method: ShareMethod) => track("share_clicked", { method, label_count: label.chips.length });
  return (
    <section className={styles.back} aria-labelledby="shared-title">
      <h1 id="shared-title" className={styles.title}>{mine ? BACK_TITLE : SHARED_TITLE}</h1>
      <BackBoard books={cards.map((card, i) => ({ card, art: arts[i] }))} label={label} />
      <div className={styles.actions}>
        {mine
          ? <ShareActions shareUrl={`${origin}/s/${code}`} count={cards.length} variant="primary" handOver={false} onShared={shared} />
          : <>
            <Button onClick={start}>{START_MINE}</Button>
            <p className={styles.status}>{SHARED_NOTE}</p>
          </>}
      </div>
    </section>
  );
}
