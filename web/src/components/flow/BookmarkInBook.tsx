"use client";
import { useEffect, useRef, useState, type AnimationEvent, type PointerEvent, type ReactNode } from "react";
import { Bookmark } from "@/components/Bookmark";
import { BookmarkBack } from "@/components/BookmarkBack";
import { hasSeenPullHint, markPullHintSeen, metDate } from "@/lib/flow/bookmarkPull";
import type { PickView } from "@/lib/flow/state";
import { track } from "@/lib/track/client";
import styles from "./BookmarkInBook.module.css";

/** New copy (DESIGN C-16, logged in context.md). */
export const PULL_OUT = "책갈피 꺼내기";
export const PULL_IN = "책갈피 넣기";
export const FLIP_BACK = "뒷면 보기";
export const FLIP_FRONT = "앞면 보기";
export const PULL_HINT = "책갈피를 꺼내 보세요";
/** How far up a finger has to move on the peeking bookmark before it counts as pulling it out. */
const DRAG_PX = 24;

type Pose = "in" | "out";
interface Props { pick: PickView; position: number; children: ReactNode }

/**
 * C-16 on S-06: the bookmark this book was met with on S-05 (`pick.art`) sticks out of the cover by its top quarter (string
 * + the top of the arch window). Tap or drag it up → `bookmark-pull` lifts it out and lays it in front of the book; while
 * it lies over the cover its film is opaque (T-03 exception). Tap again → back in. Out, it can be turned over to its
 * back (C-13: 나온 이유 + 만난 날). The keep button joins in P5 — nothing here does what it cannot do yet.
 */
export function BookmarkInBook({ pick, position, children }: Props) {
  const { card, kind, art, reason } = pick;
  const [pose, setPose] = useState<Pose>("in");
  const [moving, setMoving] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(() => !hasSeenPullHint());
  const [met] = useState(() => metDate(new Date()));
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);

  // Shown once per browser: remembered as soon as it is on screen.
  useEffect(() => { if (hint) markPullHintSeen(); }, [hint]);

  const toggle = () => {
    const next: Pose = pose === "in" ? "out" : "in";
    setPose(next);
    setMoving(true);
    setFlipped(false);
    setHint(false);
    if (next === "out") track("bookmark_pulled", { book_id: card.id, position, pick_type: kind });
  };

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    if (next) track("bookmark_flipped", { book_id: card.id, pick_type: kind });
  };

  // Drag up: the click a mouse still fires after the drag must not put the bookmark straight back.
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    dragged.current = false;
    dragFrom.current = pose === "in" ? e.clientY : null;
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragFrom.current === null || dragFrom.current - e.clientY < DRAG_PX) return;
    dragFrom.current = null;
    dragged.current = true;
    toggle();
  };
  const onPointerEnd = () => { dragFrom.current = null; };
  const onClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    toggle();
  };
  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setMoving(false);
  };

  const out = pose === "out";
  // T-03: no blur while it moves, and none while it lies over the cover (the 10-01 exception) — the frost film only when in.
  const opaque = out || moving;

  return (
    <>
      <div className={styles.stage} data-pose={pose} data-flipped={flipped ? "" : undefined}>
        <div className={styles.pull} data-pull={pose} data-anim={moving ? "" : undefined} onAnimationEnd={onAnimationEnd}>
          <div className={styles.flipper} data-3d={opaque ? "" : undefined} aria-hidden={!out}>
            <div className={styles.face} aria-hidden={flipped}><Bookmark card={card} art={art} moving={opaque} /></div>
            {opaque && (
              <div className={`${styles.face} ${styles.backFace}`} aria-hidden={!flipped}>
                <BookmarkBack card={card} reason={reason} met={met} moving />
              </div>
            )}
          </div>
          <button
            type="button" className={styles.hit} aria-expanded={out} aria-label={out ? PULL_IN : PULL_OUT}
            onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
          />
        </div>
        <div className={styles.book}>{children}</div>
        {hint && <p className={styles.hint}>{PULL_HINT}</p>}
      </div>
      {out && (
        <div className={styles.tools}>
          <button type="button" className={styles.flip} onClick={flip}>{flipped ? FLIP_FRONT : FLIP_BACK}</button>
        </div>
      )}
    </>
  );
}
