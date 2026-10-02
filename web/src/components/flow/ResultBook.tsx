"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/Button";
import { GenreTag } from "@/components/GenreTag";
import { yes24SearchUrl, type BookDetail } from "@/lib/books/detail";
import { loadDetail } from "@/lib/books/detailClient";
import type { PickView } from "@/lib/flow/state";
import { truncateIntro } from "@/lib/recommend";
import { track } from "@/lib/track/client";
import { useAccount } from "@/lib/account/store";
import { resultGuide } from "@/lib/flow/firstGuide";
import { BookmarkInBook } from "./BookmarkInBook";
import { ResultGuide } from "./FirstGuide";
import { KeepButton } from "./KeepButton";
import styles from "./ResultBook.module.css";

/** New copy (logged in context.md): the docs name the buttons of S-06 but not the way on, nor the missing-intro case. */
export const NEXT_BOOK = "다음 책";
export const LAST_BOOK = "다 봤어요";
export const NO_INTRO = "책 소개를 불러오지 못했어요";
/** Stitch README "따르지 않을 부분": the intro is YES24's, so it is labelled as such — never as our own commentary. */
export const INTRO_HEADING = "책 소개 · 예스24";
const CREDIT = { yes24: "정보 제공: 예스24", kakao: "정보 제공: 카카오" } as const;
/** C-21 waits for the page to settle (the 300ms `arrive`) before measuring what it lights. */
const GUIDE_DELAY_MS = 400;

interface Props { pick: PickView; position: number; total: number; onNext: () => void; onPrev?: () => void }

function facts(d: BookDetail | null): string[] {
  if (!d) return [];
  return [
    ...(d.rating !== null ? [`★ ${d.rating}`] : []),
    ...(d.price !== null ? [`${d.price.toLocaleString("ko-KR")}원`] : []),
    ...(d.pages !== null ? [`${d.pages}쪽`] : []),
  ];
}

/**
 * S-06 (C-11), one 궁금해요 book: big cover with its S-05 bookmark in it (C-16) → title → rating · price · pages → intro
 * (folded) → buttons → credit.
 * No 나온 이유 line (10-01, user): 🎯 mostly repeats the chosen topic. `pick.reason` is on the bookmark's back instead.
 * The parent keys it by book, so every book starts folded, loading and with its bookmark in.
 * 10-02 (5-friend test — nobody found how to keep): [🔖 꽂기] sits next to the title at all times and keeps in one tap
 * (C-16b); pulling the bookmark out only shows its back. [예스24에서 보기] is always the one main button (C-11). ‹ › sit
 * either side of the cover. The first S-06 book of a browser explains itself once (C-21).
 */
export function ResultBook({ pick, position, total, onNext, onPrev }: Props) {
  const { card, kind } = pick;
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [expanded, setExpanded] = useState(false);
  // The cover URL that failed to load (not a boolean): another book brings another URL, so the failure resets by itself.
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const account = useAccount();
  const canKeep = account.status === "in" || account.status === "out";
  const turns = total > 1 && onPrev !== undefined;
  const page = useRef<HTMLElement>(null);
  const [guide, setGuide] = useState(() => !resultGuide.hasSeen());
  const [settled, setSettled] = useState(false);
  const closeGuide = useCallback(() => {
    resultGuide.markSeen();
    setGuide(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), GUIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

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
    <section ref={page} className={styles.result} aria-labelledby="result-title" aria-busy={detail === null}>
      <p className={styles.progress}>{`궁금해요 ${position} / ${total}`}</p>

      <BookmarkInBook pick={pick} position={position}>
        <div className={styles.coverBox}>
          {/* ‹ › (10-02, 5-friend test): turn back to a 궁금해요 book already seen, like a page — either side of the cover,
              outside its edges. › stays inside the books — the last book ends with [다 봤어요] below. Names avoid
              "다음 책", the button below. */}
          {turns && (
            <button
              type="button" className={`${styles.turn} ${styles.prev}`} onClick={onPrev} disabled={position <= 1}
              aria-label="앞 책 보기" data-part="turn-prev"
            >‹</button>
          )}
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
          {turns && (
            <button
              type="button" className={`${styles.turn} ${styles.next}`} onClick={onNext} disabled={position >= total}
              aria-label="뒤 책 보기" data-part="turn-next"
            >›</button>
          )}
        </div>
      </BookmarkInBook>

      <div className={styles.head}>
        <GenreTag card={card} />
        <div className={styles.titleRow}>
          <h1 id="result-title" className={styles.title}>{card.title}</h1>
          <KeepButton pick={pick} />
        </div>
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
          variant="primary"
          href={detail?.link ?? yes24SearchUrl(card.id)}
          onClick={() => track("yes24_link_clicked", { book_id: card.id, source: "result", pick_type: kind })}
        >
          예스24에서 보기 ↗
        </LinkButton>
      </div>
      {detail?.source && <p className={styles.credit}>{CREDIT[detail.source]}</p>}
      {guide && settled && account.status !== "unknown" && (
        <ResultGuide scope={page} turns={turns} keep={canKeep} onDone={closeGuide} />
      )}
    </section>
  );
}
