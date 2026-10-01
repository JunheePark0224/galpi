"use client";
import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { FlowState, Reaction } from "@/lib/flow/state";
import { coverageNote, firstPageNotices } from "@/lib/flow/summary";
import { JUST_ONE, REWRITE, YES24_FIND, openYes24Search, understoodOf } from "@/lib/goal/understood";
import { BOOKMARK_AWAY, BOOKMARK_DOWN, BOOKMARK_RISE } from "@/lib/motion";
import { Book, RuledPage } from "./Book";
import { FirstPage, FirstPageTitle } from "./FirstPage";
import styles from "./BookScene.module.css";

/** No wording in the docs for a failed draw request — new copy, logged in context.md. */
export const DRAW_FAILED = "책을 불러오지 못했어요";

/** T-06: rise with a bounce; 궁금해요 flies up with a tilt; 패스 drops down. */
const BOOKMARK: Variants = {
  hidden: { y: 120, opacity: 0, rotate: 0 },
  shown: { y: 0, opacity: 1, rotate: 0, transition: BOOKMARK_RISE },
  gone: (reaction: Reaction) => (reaction === "curious"
    ? { y: -180, rotate: -8, opacity: 0, transition: BOOKMARK_AWAY }
    : { y: 180, opacity: 0, transition: BOOKMARK_DOWN }),
};

interface Props {
  state: FlowState;
  onOpen: () => void;
  onEdit: () => void;
  onNext: () => void;
  onRetry: () => void;
  onReact: (reaction: Reaction) => void;
  onHome: () => void;
  /** F-24 ② link / ③ button to a YES24 search (E-18, source first_page) */
  onYes24: () => void;
  /** F-24 ③ [🍃 그냥 한 권]: switch to the balance game */
  onLeaf: () => void;
}

/**
 * S-03 · S-04 · S-05 share one book so the cover keeps its place between steps. The book fills the column; the bookmark
 * rises out of the gutter, centred between the two pages. Buttons sit below the book; the page count is the folio.
 */
export function BookScene({ state, onOpen, onEdit, onNext, onRetry, onReact, onHome, onYes24, onLeaf }: Props) {
  const [busy, setBusy] = useState(true);            // a bookmark is still moving: reactions wait (and frost stays off)
  const [last, setLast] = useState<Reaction>("pass");
  const { step, status, draw } = state;
  const picks = draw?.picks ?? [];
  const pick = step === "bookmarks" ? picks[state.index] : undefined;
  const noBooks = status === "ready" && picks.length === 0;
  // F-24 ③: no topic of ours — no draw, no bookmarks; the honest ways out instead of [한 번 고치기][다음 장]
  const understood = state.entry === "target" && state.goal ? understoodOf(state.goal) : null;
  const uncovered = understood === "none";
  const editLabel = understood === "nearest" ? "다시 쓰기" : "한 번 고치기";   // a word-match miss: the old honest offer
  const findOnYes24 = () => {
    onYes24();
    openYes24Search(state.goal?.missing ?? null);   // built at the click: the phrase never sits in an href (autocapture, replay)
  };

  const react = (reaction: Reaction) => {
    if (busy) return;
    setBusy(true);
    setLast(reaction);
    onReact(reaction);
  };

  const left = step === "first" && state.opened ? <FirstPageTitle entry={state.entry ?? "leaf"} /> : <RuledPage />;
  const right = step === "bookmarks"
    ? <RuledPage turn={state.index} />
    : state.opened && (
      <FirstPage
        entry={state.entry ?? "leaf"}
        choices={state.choices}
        form={state.form}
        goal={state.goal}
        coverage={coverageNote(state.entry, state.goal, draw)}
        notices={firstPageNotices(state.entry, state.goal, draw)}
        onYes24={onYes24}
      />
    );

  return (
    <div className={styles.scene} data-wide-scene="" data-exits={uncovered ? "" : undefined}>
      <div className={styles.stage}>
        <Book open={state.opened} onPress={step === "book" ? onOpen : undefined} left={left} right={right} />
        {pick && <p className={styles.folio}>{`${state.index + 1} / ${picks.length}`}</p>}
        {pick && (
          <div className={styles.slot}>
            <AnimatePresence mode="wait" custom={last}>
              <motion.div
                key={pick.card.id}
                custom={last}
                variants={BOOKMARK}
                initial="hidden"
                animate="shown"
                exit="gone"
                onAnimationComplete={(definition) => { if (definition === "shown") setBusy(false); }}
              >
                <div className={styles.scaled}><Bookmark card={pick.card} art={pick.art} moving={busy} /></div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {step === "book" && <p className={styles.hint}>눌러서 펼치기</p>}

      {step === "first" && uncovered && (
        <div className={`${styles.actions} ${styles.exits}`}>
          <Button className={styles.full} onClick={findOnYes24}>{YES24_FIND} <span aria-hidden="true">↗</span></Button>
          {!state.edited && <Button variant="secondary" onClick={onEdit}>{REWRITE}</Button>}
          <Button variant="secondary" onClick={onLeaf}>{JUST_ONE}</Button>
        </div>
      )}

      {step === "first" && !uncovered && (
        <div className={styles.actions}>
          {status === "error" && <p className={styles.error} role="alert">{DRAW_FAILED}</p>}
          {status === "error" ? (
            <>
              <Button variant="secondary" onClick={onHome}>처음으로</Button>
              <Button onClick={onRetry}>다시 시도</Button>
            </>
          ) : (
            <>
              {!state.edited && <Button variant="secondary" onClick={onEdit}>{editLabel}</Button>}
              {noBooks
                ? <Button onClick={onHome}>처음으로</Button>
                : <Button onClick={onNext} disabled={status !== "ready"}>다음 장</Button>}
            </>
          )}
        </div>
      )}

      {step === "bookmarks" && pick && (
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={() => react("pass")}>패스</Button>
          <Button disabled={busy} onClick={() => react("curious")}>궁금해요</Button>
        </div>
      )}
    </div>
  );
}
