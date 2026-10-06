"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { FlowState, Reaction } from "@/lib/flow/state";
import { hasSeenFirstGuide, markFirstGuideSeen } from "@/lib/flow/firstGuide";
import { BOOKMARK_AWAY, BOOKMARK_DOWN, BOOKMARK_RISE } from "@/lib/motion";
import type { FoundItem } from "@/lib/collection/types";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { Book, RuledPage } from "./Book";
import { CoverPeeks } from "./CoverPeeks";
import { FirstGuide } from "./FirstGuide";
import { FirstPageTitle } from "./FirstPage";
import { FoundBadge } from "./FoundBadge";
import { PathPage } from "./PathPage";
import styles from "./BookScene.module.css";

/** No wording in the docs for a failed draw request — new copy, logged in context.md. */
export const DRAW_FAILED = "책을 불러오지 못했어요";
/** S-04 (design 10절): back to the last question; the same answer keeps these five books, another draws anew. */
export const BACK_TO_QUESTIONS = "질문으로 돌아가기";

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
  /** S-04 [← 질문으로 돌아가기] (E-33 source=first_page) */
  onBack: () => void;
  onNext: () => void;
  onRetry: () => void;
  onReact: (reaction: Reaction) => void;
  onHome: () => void;
  /** 도감 v1: parts of the bookmark now shown that a logged-in person met for the first time ("처음 만난 …!"). */
  found?: readonly FoundItem[] | null;
}

/**
 * S-03 · S-04 · S-05 share one book so the cover keeps its place between steps. The book fills the column; the bookmark
 * rises out of the gutter, centred between the two pages. Buttons sit below the book; the page count is the folio.
 */
export function BookScene({ state, onOpen, onBack, onNext, onRetry, onReact, onHome, found = null }: Props) {
  const [busy, setBusy] = useState(true);            // a bookmark is still moving: reactions wait (and frost stays off)
  const [last, setLast] = useState<Reaction>("pass");
  // C-20: the first bookmark of a browser's first round explains itself once (logged in or not)
  const [guide, setGuide] = useState(() => !hasSeenFirstGuide());
  const scene = useRef<HTMLDivElement>(null);
  const closeGuide = () => {
    markFirstGuideSeen();
    setGuide(false);
  };
  const { step, status, draw } = state;
  const picks = draw?.picks ?? [];
  const pick = step === "bookmarks" ? picks[state.index] : undefined;
  const noBooks = status === "ready" && picks.length === 0;

  const react = (reaction: Reaction) => {
    if (busy) return;
    setBusy(true);
    setLast(reaction);
    onReact(reaction);
  };

  const left = step === "first" && state.opened ? <FirstPageTitle /> : <RuledPage />;
  const right = step === "bookmarks"
    ? <RuledPage turn={state.index} />
    : state.opened && <PathPage summary={draw?.path ?? null} notices={noBooks ? [EXHAUSTED_NOTICE] : []} reason={draw?.challenge?.reason ?? null} />;

  // C-19: five decorative bookmark tips stand out of the closed book (nothing from the draw — no wait, no hint).
  const tucked = step === "book" || step === "first" ? <CoverPeeks open={state.opened} /> : null;

  return (
    <div ref={scene} className={styles.scene} data-wide-scene="" data-peeks={step === "book" ? "" : undefined} data-clip={tucked ? "" : undefined}>
      <div className={styles.stage}>
        <Book open={state.opened} onPress={step === "book" ? onOpen : undefined} left={left} right={right} tucked={tucked} />
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
                style={{ position: "relative" }}
              >
                <div className={styles.scaled}><Bookmark card={pick.card} art={pick.art} moving={busy} /></div>
                <FoundBadge items={found} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* the words moved onto the cover (C-01 tap cue, 10-02); this keeps the room the layout math counts on */}
      {step === "book" && <p className={styles.hint} aria-hidden="true" />}

      {step === "first" && (
        <div className={styles.actions}>
          {status === "error" && <p className={styles.error} role="alert">{DRAW_FAILED}</p>}
          {status === "error" ? (
            <>
              <Button variant="secondary" onClick={onHome}>처음으로</Button>
              <Button onClick={onRetry}>다시 시도</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className={styles.back} onClick={onBack}><span aria-hidden="true">← </span>{BACK_TO_QUESTIONS}</Button>
              {noBooks
                ? <Button onClick={onHome}>처음으로</Button>
                : <Button onClick={onNext} disabled={status !== "ready"}>다음 장</Button>}
            </>
          )}
        </div>
      )}

      {step === "bookmarks" && pick && (
        <div className={styles.actions} data-part="reactions">
          <Button variant="secondary" disabled={busy} onClick={() => react("pass")}>패스</Button>
          <Button disabled={busy} onClick={() => react("curious")}>궁금해요</Button>
        </div>
      )}

      {step === "bookmarks" && pick && state.index === 0 && !busy && guide && <FirstGuide scope={scene} onDone={closeGuide} />}
    </div>
  );
}
