"use client";
import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { Way } from "@/lib/recommend";
import { Button } from "@/components/Button";
import type { Topic } from "@/lib/books/taxonomy";
import { shownExamples } from "@/lib/flow/examples";
import { FREE_PLACEHOLDER, LEN_CHIPS, WAY_CHIPS, formReady, type LenChoice, type TargetForm } from "@/lib/flow/target";
import { GOAL_MAX } from "@/lib/goal/match";
import { track } from "@/lib/track/client";
import styles from "./TargetInput.module.css";

/** target-chips.md 1절 says "안내를 띄우고 멈춘다" without wording — new copy, logged in context.md. */
export const MISSING_WHAT = "보기 하나를 고르거나 직접 써 주세요";
// Plain text link, new tab, no logo; a search page would need the typed text in the URL — the home page has search.
const YES24_HOME = "https://www.yes24.com/";

/**
 * busy: a written goal is being sorted (/api/goal/classify, up to ~3 s) — the form waits instead of sending twice.
 * topics: the active 🎯 topics — an example chip whose topic is not among them is not shown.
 */
interface Props { initial: TargetForm; edit: boolean; busy?: boolean; topics: readonly Topic[]; onSubmit: (form: TargetForm) => void }
/** P-03: an open-book mark before the label (decorative — the button still reads "책 펼치기"). */
function BookIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zm0 0v13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * S-02 🎯 (C-09, 입력 B 10-01): one screen — 무엇을 (required: the field, with example chips under it that fill it) · 분량 ·
 * 읽는 방식. A form saved before B (a topic, no text) starts with an empty field: 무엇을 is asked again.
 */
export function TargetInput({ initial, edit, busy = false, topics, onSubmit }: Props) {
  const [form, setForm] = useState<TargetForm>({ ...initial, topic: null, free: initial.free ?? "" });
  const [missing, setMissing] = useState(false);
  const text = form.free ?? "";
  const examples = shownExamples(topics);

  const change = (patch: Partial<TargetForm>, chipType: "example" | "len" | "way", chipValue: string | null) => {
    setForm((f) => ({ ...f, ...patch }));
    setMissing(false);
    track("chip_selected", { chip_type: chipType, chip_value: chipValue, is_edit: edit });
  };
  // No focus on purpose: on a phone that would pop the keyboard over the rest of the form.
  const pickExample = (phrase: string) => change({ free: phrase }, "example", phrase);
  const toggleLen = (len: LenChoice) => {
    const next = form.len === len ? null : len;
    change({ len: next }, "len", next);
  };
  const toggleWay = (way: Way) => {
    const next = form.way === way ? null : way;
    change({ way: next }, "way", next);
  };

  const send = () => {
    if (busy) return;
    if (!formReady(form)) {
      setMissing(true);
      return;
    }
    onSubmit({ ...form, free: text.trim().slice(0, GOAL_MAX) });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  // A one-line answer in a two-line box: Enter sends (not mid-composition of a Korean syllable), line breaks become spaces.
  const enter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    send();
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h1 className={styles.title}>알고 싶은 게 있어요</h1>

      <div role="group" aria-labelledby="what-label" className={styles.group}>
        <p id="what-label" className={styles.label}>
          무엇을 알고 싶어요 <span className={missing ? styles.required : styles.badge}>필수</span>
        </p>
        <textarea
          className={styles.input}
          aria-label="무엇을 알고 싶어요"
          data-amp-mask
          rows={2}
          maxLength={GOAL_MAX}
          placeholder={FREE_PLACEHOLDER}
          value={text}
          onKeyDown={enter}
          onChange={(e) => {
            const free = e.target.value.replace(/[\r\n]+/g, " ");
            setForm((f) => ({ ...f, free }));
            setMissing(false);
          }}
        />
        {examples.length > 0 && (
          <div role="group" aria-label="예시" className={styles.chips}>
            {examples.map((c) => (
              <button key={c.text} type="button" className={styles.chip} aria-pressed={text === c.text} onClick={() => pickExample(c.text)}>
                {c.text}
              </button>
            ))}
          </div>
        )}
        <p className={styles.hint}>
          주제나 고민을 적어 주세요 · 제목·작가로 찾을 땐{" "}
          <a href={YES24_HOME} target="_blank" rel="noopener noreferrer">예스24 검색을 이용해 주세요 ↗</a>
        </p>
        <p className={styles.hint}>
          <span>이름·연락처는 적지 마세요</span> · <Link href="/privacy" className={styles.policy}>처리방침</Link>
        </p>
        {missing && <p role="alert" className={styles.missing}>{MISSING_WHAT}</p>}
      </div>

      <div role="group" aria-labelledby="len-label" className={styles.group}>
        <p id="len-label" className={styles.label}>분량 <span className={styles.badge}>선택</span></p>
        <div className={styles.chips}>
          {LEN_CHIPS.map((c) => (
            <button key={c.value} type="button" className={styles.chip} aria-pressed={form.len === c.value} onClick={() => toggleLen(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="way-label" className={styles.group}>
        <p id="way-label" className={styles.label}>읽는 방식 <span className={styles.badge}>선택</span></p>
        <div className={styles.chips}>
          {WAY_CHIPS.map((c) => (
            <button key={c.value} type="button" className={styles.chip} aria-pressed={form.way === c.value} onClick={() => toggleWay(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" className={styles.submit} disabled={busy} aria-busy={busy}><BookIcon />책 펼치기</Button>
    </form>
  );
}
