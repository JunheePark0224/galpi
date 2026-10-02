"use client";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

/** DESIGN C-18 colours (시안 A): brass plate, darker edge and screws, ink slot, cream letter. */
const BRASS = "#C9A45C";
const BRASS_EDGE = "#8C6B2E";
const SLOT = "#2B2724";
const LETTER = "#fffdf7";
const LETTER_EDGE = "#b9ac93";

/** The slot line in the 104 × 56 drawing: the letter is clipped here, so below it the letter is "inside". */
const SLOT_Y = 35;
/** How far the letter travels to vanish into the slot (it starts half tucked in). */
const DROP = 44;
const DROP_S = 0.5;

/**
 * The brass letter-slot plate with a cream letter half tucked in, tilted -8°. Decorative (aria-hidden): the words are on the
 * button or the sheet. `dropped` lets the letter fall into the slot once (Motion) — or, when the person asked for less
 * motion, it is simply gone. Nothing moves while idle.
 */
export function MailSlot({ className, dropped = false }: { className?: string; dropped?: boolean }) {
  const clipId = `slot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduce = useReducedMotion() === true;
  return (
    <svg className={className} viewBox="0 0 104 56" aria-hidden="true" focusable="false" data-dropped={dropped || undefined}>
      <defs>
        <clipPath id={clipId}><rect x="0" y="-40" width="104" height={SLOT_Y + 40} /></clipPath>
      </defs>
      <rect x="2" y="20" width="100" height="32" rx="6" fill={BRASS} stroke={BRASS_EDGE} strokeWidth="1.5" />
      <circle cx="11" cy="36" r="2" fill={BRASS_EDGE} />
      <circle cx="93" cy="36" r="2" fill={BRASS_EDGE} />
      <rect x="22" y={SLOT_Y - 3} width="60" height="6" rx="3" fill={SLOT} />
      <g clipPath={`url(#${clipId})`}>
        <motion.g
          initial={{ y: 0, opacity: 1 }}
          animate={dropped ? { y: DROP, opacity: reduce ? 0 : 1 } : { y: 0, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { duration: DROP_S, ease: "easeIn" }}
        >
          <g transform={`rotate(-8 52 ${SLOT_Y})`}>
            <rect x="35" y="5" width="34" height="44" rx="1.5" fill={LETTER} stroke={LETTER_EDGE} strokeWidth="1.2" />
            <path d="M35.6 5.6 L52 18 L68.4 5.6" fill="none" stroke={LETTER_EDGE} strokeWidth="1.2" strokeLinejoin="round" />
          </g>
        </motion.g>
      </g>
    </svg>
  );
}
