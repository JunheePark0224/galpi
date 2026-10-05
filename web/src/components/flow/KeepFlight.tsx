"use client";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bookmark } from "@/components/Bookmark";
import type { PickView } from "@/lib/flow/state";
import styles from "./KeepButton.module.css";

export interface FlightPath { from: { x: number; y: number }; to: { x: number; y: number } }
const FLIGHT_MS = 600;

/**
 * The moment of saving (v1.7): a small copy of the peeking bookmark flies from the cover to the header's 내 책갈피 in about
 * 600 ms on a curve — across at an even pace, up with an ease, so the path bends. Decoration only (hidden from screen
 * readers; the toast says it). Not shown with reduced motion, nor where the browser cannot animate (KeepButton decides).
 */
export function KeepFlight({ pick, path, onDone }: { pick: PickView; path: FlightPath; onDone: () => void }) {
  const across = useRef<HTMLDivElement>(null);
  const up = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => { done.current = onDone; });

  useLayoutEffect(() => {
    const x = across.current;
    const y = up.current;
    if (!x || !y || typeof x.animate !== "function") {
      done.current();
      return;
    }
    const dx = path.to.x - path.from.x;
    const dy = path.to.y - path.from.y;
    const run = x.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], { duration: FLIGHT_MS, easing: "linear" });
    y.animate(
      [{ transform: "translateY(0) scale(0.42)", opacity: 1 }, { transform: `translateY(${dy}px) scale(0.12)`, opacity: 0.5 }],
      { duration: FLIGHT_MS, easing: "cubic-bezier(0.3, 0, 0.9, 0.5)", fill: "forwards" },
    );
    run.onfinish = () => done.current();
    return () => run.cancel();
  }, [path]);

  return createPortal(
    <div ref={across} className={styles.flight} style={{ left: path.from.x, top: path.from.y }} aria-hidden="true">
      <div ref={up} className={styles.flightBody}>
        <Bookmark card={pick.card} art={pick.art} moving />
      </div>
    </div>,
    document.body,
  );
}
