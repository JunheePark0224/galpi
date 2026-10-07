"use client";
import { useEffect, useRef, useState } from "react";
import { BookmarkArt, PartShape } from "@/components/BookmarkArt";
import { Button } from "@/components/Button";
import { openLoginSheet, signedOut } from "@/lib/account/store";
import type { ArtCombo, ArtKind, Background } from "@/lib/art/combine";
import { TIER_NAMES, partName } from "@/lib/art/names";
import { loadCollection, markCollectionSeen, type CollectionLoad } from "@/lib/collection/client";
import { DEX_TABS, dexCounts, dexSections, type DexCell, type DexTab } from "@/lib/collection/service";
import type { CollectionItem } from "@/lib/collection/types";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";
import styles from "./Dex.module.css";

const TAB_NAMES: Record<DexTab, string> = { animal: "동물", bg: "배경", prop: "소품" };
/** The cell's kind in words for a screen reader ("아직 만나지 않은 동물"). */
const KIND_NAMES = { animal: "동물", bg: "배경", ground: "소품" } as const;
/** New copy (plans/2026-10-05-collection-dex.md 도감): the odds, published. */
export const ODDS_TITLE = "나오는 확률";
export const ODDS_LINE = "책갈피 한 장마다 동물·배경·땅 소품을 따로 뽑아요. 각각 일반판 90% · 한정판 9% · 초판본 1%";
export const ODDS_NOTE = "책과는 상관없이 뽑혀요. 돈으로 뽑는 기능은 없어요.";
export const LOGGED_OUT_TITLE = "로그인하면 만난 책갈피가 도감에 모여요";
export const LOGIN_TO_COLLECT = "로그인하고 모으기";

/** The common stage a ground prop is drawn on alone (the 꾸미기 cells): the peach hill. */
const GROUND_STAGE: Background = "peach";

/**
 * What a met cell draws (10-05 fix — it drew the whole first picture, so the 배경·소품 tabs were full of animals): an animal
 * on the background it was first met on; a background alone (its sky and hill); a prop alone on a common stage.
 */
export function cellPicture(cell: DexCell, first: ArtCombo): { art: ArtCombo; parts: readonly ArtKind[] } {
  switch (cell.kind) {
    case "animal":
      return { art: first, parts: ["animal"] };
    case "bg":
      return { art: { ...first, bg: cell.value as Background }, parts: ["bg"] };
    case "ground":
      return { art: { ...first, bg: GROUND_STAGE, ground: cell.value as ArtCombo["ground"] }, parts: ["ground"] };
  }
}

/**
 * 10-07 (user: the collected part should stand out): a met animal or prop cell draws that part alone, with no background
 * art behind it (`stage={false}` — a plain paper window); a background cell is its sky and hill as before.
 */
function Cell({ cell }: { cell: DexCell }) {
  const { met } = cell;
  if (met) {
    const picture = cellPicture(cell, met.firstArt);
    const bare = cell.kind !== "bg";
    return (
      <li className={styles.cell}>
        {/* the badge sits on the frame, outside the clipped arch, so the arch never cuts it (10-07) */}
        <span className={styles.frame}>
          <span className={styles.win} data-tier={cell.tier} data-bare={bare ? "" : undefined}>
            <BookmarkArt art={picture.art} parts={picture.parts} clipId={`dex-${cell.kind}-${cell.value}`} fx="light" stage={!bare} />
          </span>
          {met.isNew && <span className={styles.new}>NEW</span>}
        </span>
        <span className={styles.name}>{partName(cell.kind, cell.value)}</span>
      </li>
    );
  }
  return (
    <li className={styles.cell}>
      <span className={styles.win} data-empty="">
        <PartShape kind={cell.kind} value={cell.value} className={styles.shape} />
        <span className={styles.mark} aria-hidden="true">?</span>
      </span>
      <span className={styles.name} aria-hidden="true">???</span>
      <span className={styles.srOnly}>{`아직 만나지 않은 ${KIND_NAMES[cell.kind]}`}</span>
    </li>
  );
}

/** Counts, [동물 | 배경 | 소품], the tier sections and the odds — the same for a real and a logged-out (empty) 도감. */
function DexBody({ items }: { items: readonly CollectionItem[] }) {
  const [tab, setTab] = useState<DexTab>("animal");
  const counts = dexCounts(items);
  return (
    <>
      <p className={styles.counts}>
        {DEX_TABS.map((t) => `${TAB_NAMES[t]} ${counts[t].found} / ${counts[t].total}`).join(" · ")}
      </p>
      <div className={styles.tabs} role="group" aria-label="도감 종류">
        {DEX_TABS.map((t) => (
          <button key={t} type="button" className={styles.tab} aria-pressed={tab === t} onClick={() => setTab(t)}>{TAB_NAMES[t]}</button>
        ))}
      </div>
      {dexSections(tab, items).map((section) => (
        <section key={section.tier} className={styles.section} aria-label={`${TAB_NAMES[tab]} ${TIER_NAMES[section.tier]}`}>
          <h2 className={styles.tier} data-tier={section.tier}>
            <span>{TIER_NAMES[section.tier]}</span>
            <span className={styles.tierCount}>{`${section.found} / ${section.cells.length}`}</span>
          </h2>
          <ul className={styles.grid}>
            {section.cells.map((cell) => <Cell key={`${cell.kind}:${cell.value}`} cell={cell} />)}
          </ul>
        </section>
      ))}
      <div className={styles.odds}>
        <p><strong>{ODDS_TITLE}</strong> — {ODDS_LINE}</p>
        <p>{ODDS_NOTE}</p>
      </div>
    </>
  );
}

/** E-37 once per opening of the 도감 (StrictMode's second effect run in dev included). */
function useViewedOnce() {
  const sent = useRef(false);
  return (collected: number, loggedIn: boolean) => {
    if (sent.current) return;
    sent.current = true;
    track("collection_viewed", { collected_count: collected, is_logged_in: loggedIn });
  };
}

/**
 * 도감 (S-09 [도감], PRD F-21, 시안 `2026-10-05-dex/dex-screens.png` ①): the parts this person met — the picture they first
 * met each in, NEW until the 도감 was seen once (cleared on the server right after it shows) — and silhouettes with "???"
 * for the rest. The table missing (0004 not applied) or any failure: a plain message and a retry; the rods still work.
 */
export function Dex() {
  const [load, setLoad] = useState<CollectionLoad | null>(null);
  const [attempt, setAttempt] = useState(0);
  const viewed = useViewedOnce();

  useEffect(() => {
    let live = true;
    void loadCollection().then((answer) => {
      if (!live) return;
      setLoad(answer);
      if (answer.status === "login") {
        signedOut();
        setAmplitudeUser(null);
      }
      if (answer.status !== "ready") return;
      viewed(answer.items.length, true);
      if (answer.items.some((i) => i.isNew)) void markCollectionSeen();
    });
    return () => { live = false; };
  }, [attempt]);   // eslint-disable-line react-hooks/exhaustive-deps -- `viewed` only guards E-37

  if (!load) return <p className={styles.quiet} aria-busy="true">불러오는 중…</p>;
  if (load.status === "login") {
    return (
      <div className={styles.dex}>
        <p className={styles.quiet}>로그인이 끝났어요. 다시 로그인해 주세요.</p>
        <Button onClick={() => openLoginSheet("header")}>로그인</Button>
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div className={styles.dex}>
        <p className={styles.quiet} role="alert">도감을 불러오지 못했어요.</p>
        <Button variant="secondary" onClick={() => { setLoad(null); setAttempt((n) => n + 1); }}>다시 불러오기</Button>
      </div>
    );
  }
  return <div className={styles.dex}><DexBody items={load.items} /></div>;
}

/** 시안 ②: logged out — every cell a silhouette, and the login above them. Nothing is recorded before a login. */
export function LoggedOutDex() {
  const viewed = useViewedOnce();
  useEffect(() => { viewed(0, false); }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- once per mount
  return (
    <div className={styles.dex}>
      <div className={styles.loginCard}>
        <p className={styles.loginTitle}>{LOGGED_OUT_TITLE}</p>
        <p className={styles.loginBody}>책을 만나며 나온 동물·배경·소품이 여기 차곡차곡 쌓여요. 한정판·초판본도요.</p>
        <Button onClick={() => openLoginSheet("header")}>{LOGIN_TO_COLLECT}</Button>
      </div>
      <DexBody items={[]} />
    </div>
  );
}
