"use client";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./FirstGuide.module.css";

/** Copy of C-20 (10-02, user — 5-friend test: first-time visitors did not know where to look). */
export const GUIDE_TITLE = "책갈피 보는 법";
export const GUIDE_NAME = "① 위는 제목, 아래는 저자";
export const GUIDE_LINE = "② 이 한 줄이 책의 첫인상이에요";
export const GUIDE_REACT = "③ 끌리면 궁금해요, 아니면 패스";
export const GUIDE_OK = "알겠어요";

/** Copy of C-21 (10-02, user — 5-friend test: testers could not find how to keep a bookmark on S-06). */
export const RESULT_GUIDE_TITLE = "궁금해요 책 보는 법";
export const RESULT_GUIDE_PULL = "책갈피를 누르면 꺼내져요 · 뒷면에 나온 이유";
/** v1.7 (10-05, wording B): the step names the saving button as it now reads. */
export const RESULT_GUIDE_KEEP = "🔖 내 책갈피에 저장해 두면 나중에 다시 볼 수 있어요";
export const RESULT_GUIDE_TURN = "‹ › 로 앞뒤 책을 봐요";

const PAD = 6;     // room around each lit part
const GAP = 8;     // between a lit part and its words
const EDGE = 16;   // the words never come closer to the screen's side than the page gutter

type Box = { top: number; left: number; right: number; bottom: number };

/**
 * One lit part of a guide: the elements marked `data-part` with these names (lit as one frame), its words above or
 * below the frame, and — on one step — [알겠어요] with the words.
 */
export interface GuideStep { parts: readonly string[]; words: string; place: "above" | "below"; ok?: boolean }

const boxOf = (el: Element | null): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
};
const union = (a: Box | null, b: Box | null): Box | null =>
  a && b ? { top: Math.min(a.top, b.top), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) } : a ?? b;

/** Where each step's parts are now, or null while one step has nothing on screen yet. */
function measure(scope: HTMLElement | null, steps: readonly GuideStep[]): Box[] | null {
  if (!scope) return null;
  const boxes: Box[] = [];
  for (const step of steps) {
    const box = step.parts.reduce<Box | null>((b, part) => union(b, boxOf(scope.querySelector(`[data-part="${part}"]`))), null);
    if (!box) return null;
    boxes.push(box);
  }
  // Two parts close above each other (S-05: the author line and the one-liner): split the gap so the lit frames meet
  // instead of overlapping
  for (let i = 1; i < boxes.length; i++) {
    const [a, b] = [boxes[i - 1], boxes[i]];
    const side = a.left < b.right && b.left < a.right;
    if (side && a.top < b.top && a.bottom + PAD > b.top - PAD) {
      const mid = (a.bottom + b.top) / 2;
      boxes[i - 1] = { ...a, bottom: mid - PAD - 1 };
      boxes[i] = { ...b, top: mid + PAD + 1 };
    }
  }
  return boxes;
}

/**
 * v1.7: on a short phone the lowest lit part (S-06 [🔖 내 책갈피에 저장], under the title) can sit below the screen. The page
 * scrolls just enough for it to show — the save button is the point of step ③ — before the parts are measured.
 */
function bringLowestIntoView(boxes: readonly Box[]): void {
  const bottom = Math.max(...boxes.map((b) => b.bottom)) + PAD + EDGE;
  if (bottom > window.innerHeight) window.scrollBy({ top: bottom - window.innerHeight, behavior: "instant" });
}

interface GuideProps { scope: RefObject<HTMLElement | null>; title: string; steps: readonly GuideStep[]; onDone: () => void }

/**
 * C-20 · C-21: the page dims except the lit parts, each with a short line, and [알겠어요]. A tap anywhere, the button or
 * Escape closes it. A modal dialog (focus on [알겠어요]); the words are real text, so screen readers read them all.
 */
export function Guide({ scope, title, steps, onDone }: GuideProps) {
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ok = useRef<HTMLButtonElement>(null);
  const words = useRef<(HTMLDivElement | null)[]>([]);
  const titleId = useId();
  const maskId = useId();

  // The parts are measured on the next frame (the page has just settled) and again on every resize.
  useEffect(() => {
    const update = () => {
      const first = measure(scope.current, steps);
      if (first) bringLowestIntoView(first);
      setBoxes(first && measure(scope.current, steps));
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [scope, steps]);
  const shown = boxes !== null;
  useEffect(() => { if (shown) ok.current?.focus(); }, [shown]);

  // Words are centred on their part; a part near the side would push them off the screen, so they slide back inside the
  // gutter before they are painted — and below the top edge, when the page scrolled to show the lowest part (v1.7).
  useLayoutEffect(() => {
    for (const el of words.current) {
      if (!el) continue;
      el.style.marginLeft = "0px";
      el.style.marginTop = "0px";
      const r = el.getBoundingClientRect();
      const shift = r.left < EDGE ? EDGE - r.left : r.right > size.w - EDGE ? size.w - EDGE - r.right : 0;
      el.style.marginLeft = `${shift}px`;
      if (r.top < EDGE) el.style.marginTop = `${EDGE - r.top}px`;
    }
  }, [boxes, size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); if (e.key === "Escape") onDone(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!boxes) return null;
  const frame = (b: Box) => ({ x: b.left - PAD, y: b.top - PAD, width: b.right - b.left + PAD * 2, height: b.bottom - b.top + PAD * 2 });

  return createPortal(
    <div className={styles.guide} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onDone} data-first-guide="">
      <svg className={styles.dim} width={size.w} height={size.h} aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {boxes.map((b, i) => <rect key={i} {...frame(b)} rx={10} fill="black" />)}
          </mask>
        </defs>
        <rect width="100%" height="100%" className={styles.shade} mask={`url(#${maskId})`} />
        {boxes.map((b, i) => <rect key={i} {...frame(b)} rx={10} className={styles.ring} />)}
      </svg>
      <h2 id={titleId} className={styles.srOnly}>{title}</h2>
      {steps.map((step, i) => {
        const b = boxes[i];
        const above = step.place === "above";
        const top = above ? b.top - PAD - GAP : b.bottom + PAD + GAP;
        return (
          <div
            key={step.words} ref={(el) => { words.current[i] = el; }} className={`${styles.step} ${above ? styles.above : ""}`}
            style={{ top, left: (b.left + b.right) / 2 }}
          >
            <p className={styles.note}>{step.words}</p>
            {step.ok && <button ref={ok} type="button" className={styles.ok} onClick={onDone}>{GUIDE_OK}</button>}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/** C-20 on S-05: title and author, the one-liner, the 패스 / 궁금해요 row (data-part marks in Bookmark and the reaction row). */
const FIRST_STEPS: readonly GuideStep[] = [
  { parts: ["title", "author"], words: GUIDE_NAME, place: "above" },
  { parts: ["line"], words: GUIDE_LINE, place: "below", ok: true },
  { parts: ["reactions"], words: GUIDE_REACT, place: "above" },
];

export function FirstGuide({ scope, onDone }: { scope: RefObject<HTMLElement | null>; onDone: () => void }) {
  return <Guide scope={scope} title={GUIDE_TITLE} steps={FIRST_STEPS} onDone={onDone} />;
}

/**
 * C-21 on S-06: the peeking bookmark, the ‹ › arrows beside the cover, [🔖 내 책갈피에 저장] — numbered top to bottom, the
 * way the eye reads them. With one book there are no arrows, and without login on this site no save button: those steps drop.
 * [알겠어요] comes with the last step.
 */
const RESULT_PULL: GuideStep = { parts: ["peek"], words: RESULT_GUIDE_PULL, place: "above" };
const RESULT_TURN: GuideStep = { parts: ["turn-prev", "turn-next"], words: RESULT_GUIDE_TURN, place: "above" };
const RESULT_KEEP: GuideStep = { parts: ["keep"], words: RESULT_GUIDE_KEEP, place: "above" };

export function resultGuideSteps(turns: boolean, keep: boolean): readonly GuideStep[] {
  const steps = [RESULT_PULL, ...(turns ? [RESULT_TURN] : []), ...(keep ? [RESULT_KEEP] : [])];
  return steps.map((step, i) => ({ ...step, words: `${"①②③"[i]} ${step.words}`, ok: i === steps.length - 1 }));
}

interface ResultGuideProps { scope: RefObject<HTMLElement | null>; turns: boolean; keep: boolean; onDone: () => void }

export function ResultGuide({ scope, turns, keep, onDone }: ResultGuideProps) {
  const steps = useMemo(() => resultGuideSteps(turns, keep), [turns, keep]);
  return <Guide scope={scope} title={RESULT_GUIDE_TITLE} steps={steps} onDone={onDone} />;
}
