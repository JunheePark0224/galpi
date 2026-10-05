"use client";
import { useEffect, useMemo, useState } from "react";
import { Bookmark } from "@/components/Bookmark";
import { BookmarkArt, PartShape } from "@/components/BookmarkArt";
import { Button } from "@/components/Button";
import {
  ART_KINDS, EMPTY_GROUND, isRare, KIND_TIERS, TIERS, type ArtCombo, type ArtKind, type Tier,
} from "@/lib/art/combine";
import { TIER_NAMES, partName } from "@/lib/art/names";
import { loadCollection, type CollectionLoad } from "@/lib/collection/client";
import { ownedSet, partAllowed, sameArt } from "@/lib/library/decorate";
import type { LibraryBookmark } from "@/lib/library/types";
import { cellPicture } from "./Dex";
import styles from "./Decorate.module.css";
import sheet from "./Library.module.css";

/** New copy (시안 `mockups/2026-10-05-decorate/flow.png` ②, DESIGN C-26). */
export const DECORATE_TITLE = "책갈피 꾸미기";
export const RESET = "처음 그림으로";
export const SAVE_ART = "이대로 꽂기";
export const DEX_FAILED = "도감을 불러오지 못했어요";
const SAVE_FAILED = "꽂지 못했어요. 다시 해 주세요.";
const TAB_NAMES: Record<ArtKind, string> = { animal: "동물", bg: "배경", sky: "하늘 소품", ground: "땅 소품" };
/** The empty ground is a choice, not a collectible — it has no 도감 name. */
const NONE_NAME = "없음";
const nameOf = (kind: ArtKind, value: string) => (kind === "ground" && value === EMPTY_GROUND ? NONE_NAME : partName(kind, value));

interface CellProps { kind: ArtKind; value: string; tier: Tier; draft: ArtCombo; allowed: boolean; onPick: () => void }

/** One part: its picture to pick (the current one outlined), or a 🔒 silhouette that cannot be picked. */
function Cell({ kind, value, tier, draft, allowed, onPick }: CellProps) {
  const chosen = draft[kind] === value;
  if (!allowed) {
    return (
      <li>
        <button type="button" className={styles.cell} disabled aria-label={`${nameOf(kind, value)}, 잠김`}>
          <span className={styles.win} data-locked="">
            <PartShape kind={kind} value={value} className={styles.shape} />
            <span className={styles.lock} aria-hidden="true">🔒</span>
          </span>
        </button>
      </li>
    );
  }
  // the draft with this part in its place: an animal sits on the draft's background, a background or prop shows alone
  const picture = cellPicture({ kind, value, tier, met: null }, { ...draft, [kind]: value } as ArtCombo);
  return (
    <li>
      <button type="button" className={styles.cell} aria-pressed={chosen} aria-label={`${nameOf(kind, value)}, ${TIER_NAMES[tier]}`} onClick={onPick}>
        <span className={styles.win} data-tier={tier}>
          <BookmarkArt art={picture.art} parts={picture.parts} clipId={`deco-${kind}-${value}`} fx="light" />
          {kind === "ground" && value === EMPTY_GROUND && <span className={styles.noneName} aria-hidden="true">{NONE_NAME}</span>}
        </span>
      </button>
    </li>
  );
}

interface Props {
  bookmark: LibraryBookmark & { originalArt: ArtCombo };
  /** "2026. 10. 4." — the day it was kept, as the sheet's front shows it. */
  met: string;
  /** Saves the picture; true when the server took it. */
  onSave: (art: ArtCombo) => Promise<boolean>;
  onBack: () => void;
}

/**
 * C-26 책갈피 꾸미기 (PRD F-13·F-21, 시안 flow.png ②): the bookmark's front, live, at the top; [동물 | 배경 | 하늘 소품 |
 * 땅 소품]; the parts by tier (일반판 · 한정판 · 초판본). Only parts in the person's 도감, the bookmark's own first parts and
 * the empty ground can be picked (the server checks the same rule) — the rest are 🔒 silhouettes. A footer that stays at
 * the bottom: [처음 그림으로] (the picture it was kept with, in the preview) and [이대로 꽂기]. The 도감 not loading: a
 * plain message, nothing can be saved.
 */
export function DecorateEditor({ bookmark, met, onSave, onBack }: Props) {
  const [draft, setDraft] = useState<ArtCombo>(bookmark.art);
  const [tab, setTab] = useState<ArtKind>("animal");
  const [load, setLoad] = useState<CollectionLoad | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const original = bookmark.originalArt;

  useEffect(() => {
    let live = true;
    void loadCollection().then((answer) => { if (live) setLoad(answer); });
    return () => { live = false; };
  }, []);

  const ready = load?.status === "ready";
  const owned = useMemo(() => ownedSet(load?.status === "ready" ? load.items : []), [load]);
  const pick = (kind: ArtKind, value: string) => {
    const parts = { animal: draft.animal, bg: draft.bg, sky: draft.sky, ground: draft.ground, [kind]: value } as Omit<ArtCombo, "rare">;
    setDraft({ ...parts, rare: isRare(parts) });
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onSave(draft);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.preview}>
        <span className={sheet.big}>
          <Bookmark card={bookmark.card} art={draft} met={met} moving />
        </span>
      </div>
      <div className={styles.tabs} role="group" aria-label="꾸밀 부분">
        {ART_KINDS.map((k) => (
          <button key={k} type="button" className={styles.tab} aria-pressed={tab === k} onClick={() => setTab(k)}>{TAB_NAMES[k]}</button>
        ))}
      </div>
      {!load && <p className={styles.quiet} aria-busy="true">도감을 불러오는 중…</p>}
      {load && !ready && <p className={styles.quiet} role="alert">{DEX_FAILED}</p>}
      {load && TIERS.map((tier) => (
        <section key={tier} className={styles.section} aria-label={`${TAB_NAMES[tab]} ${TIER_NAMES[tier]}`}>
          <h3 className={styles.tier} data-tier={tier}>{TIER_NAMES[tier]}</h3>
          <ul className={styles.grid}>
            {KIND_TIERS[tab][tier].map((value) => (
              <Cell
                key={value} kind={tab} value={value} tier={tier} draft={draft}
                allowed={ready && partAllowed(tab, value, original, owned)} onPick={() => pick(tab, value)}
              />
            ))}
          </ul>
        </section>
      ))}
      <button type="button" className={sheet.textButton} onClick={onBack}>뒤로</button>
      <div className={styles.footer}>
        {failed && <p role="alert" className={sheet.error}>{SAVE_FAILED}</p>}
        <div className={styles.footerRow}>
          <Button variant="secondary" disabled={!ready || busy || sameArt(draft, original)} onClick={() => setDraft(original)}>{RESET}</Button>
          <Button disabled={!ready || busy || sameArt(draft, bookmark.art)} onClick={() => void save()}>{SAVE_ART}</Button>
        </div>
      </div>
    </div>
  );
}
