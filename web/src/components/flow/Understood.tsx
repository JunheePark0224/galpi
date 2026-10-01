import { Fragment, useId } from "react";
import type { GoalMatch } from "@/lib/goal/match";
import {
  FOUND_SUFFIX, NOT_COVERED, NOT_YET, UNDERSTOOD_LABEL, openYes24Search, roParticle, similarBooks, understoodOf, understoodPath,
  unbreakable, yes24FindMissing,
} from "@/lib/goal/understood";
import styles from "./Understood.module.css";

interface Props {
  goal: GoalMatch;
  /** ①+ the honest count of keyword books, or the nearest-topic line of a word-match miss (summary.ts coverageNote) */
  coverage: string | null;
  /** ② [예스24에서 '…' 찾기] was pressed (E-18, source first_page) */
  onYes24?: () => void;
}

/**
 * PRD F-24 "이렇게 이해했어요" (DESIGN C-17, mockup C′): right under the 무엇을 row, the depth the goal reached as a path
 * 분야 › 주제 › 키워드 — the last reached segment in ink, the rest soft. Each segment stays whole (no-break spaces + nowrap);
 * the › rides on the end of the segment before it, so a wrapped line ends with ›.
 * The visitor's words (the missing phrase) appear only as text inside the masked first page — never in an attribute.
 */
export function Understood({ goal, coverage, onYes24 }: Props) {
  const labelId = useId();
  const understood = understoodOf(goal);
  if (goal.method === "example") {
    // an untouched example chip is not the visitor's own words: one short line
    return <p className={styles.short}>{`→ ${unbreakable(goal.topic)}${roParticle(goal.topic)} ${FOUND_SUFFIX}`}</p>;
  }
  const segs = understoodPath(goal);
  const lastReached = segs.reduce((acc, seg, i) => (seg.kind === "reached" ? i : acc), -1);
  const found = understood === "keyword" || understood === "topic";
  const missing = understood === "missing" ? goal.missing : null;
  return (
    <section className={styles.block} aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>{UNDERSTOOD_LABEL}</p>
      {understood === "none" && <p className={styles.none}>{NOT_COVERED}</p>}
      {segs.length > 0 && (
        <p className={styles.path}>
          {segs.map((seg, i) => {
            const last = i === segs.length - 1;
            const name = unbreakable(seg.name);
            return (
              <Fragment key={seg.name}>
                <span className={styles.seg} data-kind={seg.kind} data-last={i === lastReached ? "" : undefined}>
                  {seg.kind === "missing"
                    // the · stays at the end of the name, so a wrapped box never starts a line with it
                    ? <span className={styles.gone}>{`${name} ·`} <span className={styles.goneNote}>{unbreakable(NOT_YET)}</span></span>
                    : <><b className={styles.name}>{name}</b>{found && last && roParticle(seg.name)}</>}
                  {!last && <>{" "}<span className={styles.sep} aria-hidden="true">›</span></>}
                </span>
                {!last && " "}
              </Fragment>
            );
          })}
          {found && <>{" "}<span className={styles.suffix}>{FOUND_SUFFIX}</span></>}
        </p>
      )}
      {coverage && <p className={understood === "nearest" ? styles.none : styles.more}>{coverage}</p>}
      {missing && (
        <>
          <p className={styles.more}>{similarBooks(unbreakable(goal.topic))}</p>
          <button
            type="button"
            className={styles.yes24}
            onClick={() => {
              onYes24?.();
              openYes24Search(missing);
            }}
          >
            <span>{yes24FindMissing(unbreakable(missing))}{" "}<span aria-hidden="true">↗</span></span>
          </button>
        </>
      )}
    </section>
  );
}
