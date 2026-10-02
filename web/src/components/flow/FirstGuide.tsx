"use client";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./FirstGuide.module.css";

/** Copy of C-20 (10-02, user — 5-friend test: first-time visitors did not know where to look). */
export const GUIDE_TITLE = "책갈피 보는 법";
export const GUIDE_NAME = "① 위는 제목, 아래는 저자";
export const GUIDE_LINE = "② 이 한 줄이 책의 첫인상이에요";
export const GUIDE_REACT = "③ 끌리면 궁금해요, 아니면 패스";
export const GUIDE_OK = "알겠어요";

const PAD = 6;     // room around each lit part
const GAP = 8;     // between a lit part and its words

type Box = { top: number; left: number; right: number; bottom: number };
interface Parts { name: Box; line: Box; reactions: Box }

const boxOf = (el: Element | null): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
};
const union = (a: Box, b: Box | null): Box =>
  b ? { top: Math.min(a.top, b.top), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) } : a;

/** Where the three parts are now (data-part marks in Bookmark and the S-05 reaction row), or null if one is missing. */
function measure(scope: HTMLElement | null): Parts | null {
  if (!scope) return null;
  const title = boxOf(scope.querySelector('[data-part="title"]'));
  const line = boxOf(scope.querySelector('[data-part="line"]'));
  const reactions = boxOf(scope.querySelector('[data-part="reactions"]'));
  if (!title || !line || !reactions) return null;
  const name = union(title, boxOf(scope.querySelector('[data-part="author"]')));
  // The author line sits close to the one-liner: split the gap so the two lit frames meet instead of overlapping
  if (name.bottom + PAD > line.top - PAD) {
    const mid = (name.bottom + line.top) / 2;
    return { name: { ...name, bottom: mid - PAD - 1 }, line: { ...line, top: mid + PAD + 1 }, reactions };
  }
  return { name, line, reactions };
}

interface Props { scope: RefObject<HTMLElement | null>; onDone: () => void }

/**
 * C-20: over the first bookmark of S-05, the page dims except three lit parts — title and author, the one-liner, the
 * 패스 / 궁금해요 row — each with a short line, and [알겠어요]. A tap anywhere, the button or Escape closes it. A modal dialog
 * (focus on [알겠어요]); the words are real text, so screen readers read all three.
 */
export function FirstGuide({ scope, onDone }: Props) {
  const [parts, setParts] = useState<Parts | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ok = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const maskId = useId();

  // The parts are measured on the next frame (the bookmark has just landed) and again on every resize.
  useEffect(() => {
    const update = () => {
      setParts(measure(scope.current));
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [scope]);
  const shown = parts !== null;
  useEffect(() => { if (shown) ok.current?.focus(); }, [shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); if (e.key === "Escape") onDone(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!parts) return null;
  const lit = [parts.name, parts.line, parts.reactions];
  const centre = (parts.name.left + parts.name.right) / 2;

  return createPortal(
    <div className={styles.guide} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onDone} data-first-guide="">
      <svg className={styles.dim} width={size.w} height={size.h} aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {lit.map((b, i) => (
              <rect key={i} x={b.left - PAD} y={b.top - PAD} width={b.right - b.left + PAD * 2} height={b.bottom - b.top + PAD * 2} rx={10} fill="black" />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" className={styles.shade} mask={`url(#${maskId})`} />
        {lit.map((b, i) => (
          <rect key={i} x={b.left - PAD} y={b.top - PAD} width={b.right - b.left + PAD * 2} height={b.bottom - b.top + PAD * 2} rx={10} className={styles.ring} />
        ))}
      </svg>
      <h2 id={titleId} className={styles.srOnly}>{GUIDE_TITLE}</h2>
      <p className={`${styles.note} ${styles.above}`} style={{ top: parts.name.top - PAD - GAP, left: centre }}>{GUIDE_NAME}</p>
      <div className={styles.middle} style={{ top: parts.line.bottom + PAD + GAP, left: centre }}>
        <p className={styles.note}>{GUIDE_LINE}</p>
        <button ref={ok} type="button" className={styles.ok} onClick={onDone}>{GUIDE_OK}</button>
      </div>
      <p className={`${styles.note} ${styles.above}`} style={{ top: parts.reactions.top - PAD - GAP, left: (parts.reactions.left + parts.reactions.right) / 2 }}>
        {GUIDE_REACT}
      </p>
    </div>,
    document.body,
  );
}
