"use client";
import { useRef, useState, type AnimationEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Bookmark } from "@/components/Bookmark";
import { BookmarkBack } from "@/components/BookmarkBack";
import { metDate } from "@/lib/flow/bookmarkPull";
import type { PickView } from "@/lib/flow/state";
import { track } from "@/lib/track/client";
import styles from "./BookmarkInBook.module.css";

/** New copy (DESIGN C-16, logged in context.md). The pull button keeps one name; `aria-expanded` says in or out. */
export const PULL_OUT = "책갈피 꺼내기";
export const FLIP_BACK = "뒷면 보기";
export const FLIP_FRONT = "앞면 보기";
/** The hover cue (mouse and pen only, 10-02): hovering lifts the bookmark a little — it never pulls it out. */
export const PULL_CUE = "눌러서 꺼내기";
/** Read out (role="status") when the bookmark turns over — the visible face changes without focus moving. */
export const SAID_FRONT = "책갈피 앞면";
export const saidBack = (label: string, items: readonly string[], met: string) =>
  ["책갈피 뒷면", items.length > 0 ? `${label}: ${items.join(", ")}` : "", `만난 날 ${met}`].filter((p) => p !== "").join(". ");
/** How far up a mouse or pen has to drag the peeking bookmark before it counts as pulling it out. */
const DRAG_PX = 24;

type Pose = "in" | "out";

interface Props { pick: PickView; position: number; children: ReactNode }

/**
 * C-16 on S-06: the bookmark this book was met with on S-05 (`pick.art`) sticks out of the cover by its top quarter (string
 * + the top of the arch window). Tap it (or drag it up with a mouse or pen) → `bookmark-pull` lifts it out and lays it in
 * front of the book; while it lies over the cover its film is opaque (T-03 exception). Tap again → back in. Out, it can be
 * turned over to its back (C-13: 나온 이유 + 만난 날). Keeping it is [🔖 내 책갈피에 저장] under the title (C-16b, v1.7) —
 * pulling out is not needed first. With a mouse or pen, hovering the peek lifts it a few px and shows "눌러서 꺼내기"
 * (CSS only). Touch is tap only: a finger swipe on the peek scrolls the page like anywhere else.
 */
export function BookmarkInBook({ pick, position, children }: Props) {
  const { card, kind, art, reason } = pick;
  const [pose, setPose] = useState<Pose>("in");
  const [moving, setMoving] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [said, setSaid] = useState("");
  const [met] = useState(() => metDate(new Date()));
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);

  const toggle = () => {
    const next: Pose = pose === "in" ? "out" : "in";
    setPose(next);
    setMoving(true);
    setFlipped(false);
    setSaid("");
    if (next === "out") track("bookmark_pulled", { book_id: card.id, position, pick_type: kind });
  };

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    setSaid(next ? saidBack(reason.label, reason.items, met) : SAID_FRONT);
    if (next) track("bookmark_flipped", { book_id: card.id, pick_type: kind });
  };

  // Drag up (mouse and pen only). The button holds the pointer while pressed, so a release outside still ends the drag;
  // the click the browser fires right after a drag must not put the bookmark straight back.
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    dragged.current = false;
    dragFrom.current = null;
    if (e.pointerType === "touch" || pose !== "in") return;
    dragFrom.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragFrom.current === null || e.buttons === 0 || dragFrom.current - e.clientY < DRAG_PX) return;
    dragFrom.current = null;
    dragged.current = true;
    toggle();
  };
  // A trailing click comes in the same task as pointerup: forget the drag right after it.
  const onPointerUp = () => {
    dragFrom.current = null;
    if (dragged.current) setTimeout(() => { dragged.current = false; }, 0);
  };
  const onPointerCancel = () => {
    dragFrom.current = null;
    dragged.current = false;
  };
  const onKeyDown = () => { dragged.current = false; };
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // detail 0 = keyboard or assistive tech: never the trailing click of a drag.
    if (dragged.current && e.detail !== 0) {
      dragged.current = false;
      return;
    }
    dragged.current = false;
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
            type="button" className={styles.hit} aria-expanded={out} aria-label={PULL_OUT} data-part="peek"
            onClick={onClick} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={() => { dragFrom.current = null; }}
          />
        </div>
        <div className={styles.book}>{children}</div>
        {!out && <span className={styles.cue} aria-hidden="true">{PULL_CUE}</span>}
      </div>
      {out && (
        <div className={styles.tools}>
          <button type="button" className={styles.flip} onClick={flip}>{flipped ? FLIP_FRONT : FLIP_BACK}</button>
          <span className={styles.said} role="status">{said}</span>
        </div>
      )}
    </>
  );
}
