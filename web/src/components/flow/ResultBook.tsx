"use client";
import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/Button";
import { GenreTag } from "@/components/GenreTag";
import { yes24SearchUrl, type BookDetail } from "@/lib/books/detail";
import { loadDetail } from "@/lib/books/detailClient";
import type { PickView } from "@/lib/flow/state";
import { truncateIntro } from "@/lib/recommend";
import { track } from "@/lib/track/client";
import styles from "./ResultBook.module.css";

/** New copy (logged in context.md): the docs name the buttons of S-06 but not the way on, nor the missing-intro case. */
export const NEXT_BOOK = "다음 책";
export const LAST_BOOK = "다 봤어요";
export const NO_INTRO = "책 소개를 불러오지 못했어요";
/** Stitch README "따르지 않을 부분": the intro is YES24's, so it is labelled as such — never as our own commentary. */
export const INTRO_HEADING = "책 소개 · 예스24";
const CREDIT = { yes24: "정보 제공: 예스24", kakao: "정보 제공: 카카오" } as const;

interface Props { pick: PickView; position: number; total: number; onNext: () => void }

function facts(d: BookDetail | null): string[] {
  if (!d) return [];
  return [
    ...(d.rating !== null ? [`★ ${d.rating}`] : []),
    ...(d.price !== null ? [`${d.price.toLocaleString("ko-KR")}원`] : []),
    ...(d.pages !== null ? [`${d.pages}쪽`] : []),
  ];
}

/**
 * S-06 (C-11), one 궁금해요 book: big cover → title → rating · price · pages → intro (folded) → buttons → credit.
 * No 나온 이유 line (10-01, user): 🎯 mostly repeats the chosen topic. The draw still carries `pick.reason` for the
 * bookmark back in P5.
 * The parent keys it by book, so every book starts folded and loading. [보관] joins in P5 (a button that does nothing would
 * mislead — the same call as the empty login slot, context 09-30).
 */
export function ResultBook({ pick, position, total, onNext }: Props) {
  const { card, kind } = pick;
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [expanded, setExpanded] = useState(false);
  // The cover URL that failed to load (not a boolean): another book brings another URL, so the failure resets by itself.
  const [failedCover, setFailedCover] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadDetail(card.id).then((d) => { if (live) setDetail(d); });
    return () => { live = false; };
  }, [card.id]);

  const intro = detail?.intro ?? "";
  const short = truncateIntro(intro);
  const line = facts(detail);
  const cover = detail?.cover && detail.cover !== failedCover ? detail.cover : null;

  const expand = () => {
    setExpanded(true);
    track("description_expanded", { book_id: card.id, pick_type: kind });
  };

  return (
    <section className={styles.result} aria-labelledby="result-title" aria-busy={detail === null}>
      <p className={styles.progress}>{`궁금해요 ${position} / ${total}`}</p>

      <div className={styles.coverBox}>
        {cover ? (
          // A third-party cover shown as YES24 serves it — not copied through our image optimiser. No Referer is sent (hotlink
          // filters); if it still fails, our own cloth cover takes its place.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.cover} src={cover} alt={`${card.title} 표지`}
            referrerPolicy="no-referrer" decoding="async" onError={() => setFailedCover(cover)}
          />
        ) : (
          <div className={styles.plainCover} aria-hidden="true"><span>{card.title}</span></div>
        )}
      </div>

      <div className={styles.head}>
        <GenreTag card={card} />
        <h1 id="result-title" className={styles.title}>{card.title}</h1>
        <p className={styles.author}>{card.author}</p>
        {line.length > 0 && <p className={styles.facts}>{line.join(" · ")}</p>}
      </div>

      {detail === null ? (
        <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
      ) : intro ? (
        <section className={styles.intro} aria-labelledby="intro-heading">
          <h2 id="intro-heading" className={styles.introHeading}>{INTRO_HEADING}</h2>
          <p className={expanded ? styles.introFull : styles.introText}>{expanded ? intro : short.text}</p>
          {short.truncated && !expanded && (
            <button type="button" className={styles.more} onClick={expand}>더 보기</button>
          )}
        </section>
      ) : (
        <p className={styles.note}>{NO_INTRO}</p>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onNext}>{position < total ? NEXT_BOOK : LAST_BOOK}</Button>
        <LinkButton
          href={detail?.link ?? yes24SearchUrl(card.id)}
          onClick={() => track("yes24_link_clicked", { book_id: card.id, source: "result", pick_type: kind })}
        >
          예스24에서 보기 ↗
        </LinkButton>
      </div>
      {detail?.source && <p className={styles.credit}>{CREDIT[detail.source]}</p>}
    </section>
  );
}
