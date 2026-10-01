"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import type { Way } from "@/lib/recommend";
import { Button } from "@/components/Button";
import { TOPIC_CHIPS, type Topic } from "@/lib/books/taxonomy";
import { FREE_PLACEHOLDER, LEN_CHIPS, WAY_CHIPS, formReady, type LenChoice, type TargetForm } from "@/lib/flow/target";
import { GOAL_MAX } from "@/lib/goal/match";
import { track } from "@/lib/track/client";
import styles from "./TargetInput.module.css";

/** target-chips.md 1절 says "안내를 띄우고 멈춘다" without wording — new copy, logged in context.md. */
export const MISSING_WHAT = "보기 하나를 고르거나 직접 써 주세요";
// Plain text link, new tab, no logo; a search page would need the typed text in the URL — the home page has search.
const YES24_HOME = "https://www.yes24.com/";

/** busy: a written goal is being sorted (/api/goal/classify, up to ~3 s) — the form waits instead of sending twice. */
interface Props { initial: TargetForm; edit: boolean; busy?: boolean; onSubmit: (form: TargetForm) => void }
/** P-03: an open-book mark before the label (decorative — the button still reads "책 펼치기"). */
function BookIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zm0 0v13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** S-02 🎯 (C-09): one screen — 무엇을 (required: 6 chips or 직접 쓰기) · 분량 · 읽는 방식. */
export function TargetInput({ initial, edit, busy = false, onSubmit }: Props) {
  const [form, setForm] = useState<TargetForm>(initial);
  const [missing, setMissing] = useState(false);
  const freeInput = useRef<HTMLInputElement>(null);

  const change = (patch: Partial<TargetForm>, chipType: "topic" | "len" | "way", chipValue: string | null) => {
    setForm((f) => ({ ...f, ...patch }));
    setMissing(false);
    track("chip_selected", { chip_type: chipType, chip_value: chipValue, is_edit: edit });
  };
  const pickTopic = (topic: Topic) => change({ topic, free: null }, "topic", topic);
  const pickFree = () => {
    change({ topic: null, free: form.free ?? "" }, "topic", "free");
    setTimeout(() => freeInput.current?.focus(), 0);
  };
  const toggleLen = (len: LenChoice) => {
    const next = form.len === len ? null : len;
    change({ len: next }, "len", next);
  };
  const toggleWay = (way: Way) => {
    const next = form.way === way ? null : way;
    change({ way: next }, "way", next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!formReady(form)) {
      setMissing(true);
      return;
    }
    onSubmit({ ...form, free: form.free === null ? null : form.free.trim().slice(0, GOAL_MAX) });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h1 className={styles.title}>알고 싶은 게 있어요</h1>

      <div role="group" aria-labelledby="what-label" className={styles.group}>
        <p id="what-label" className={styles.label}>
          무엇을 알고 싶어요 <span className={missing ? styles.required : styles.badge}>필수</span>
        </p>
        <div className={styles.chips}>
          {TOPIC_CHIPS.map((c) => (
            <button key={c.topic} type="button" className={styles.chip}
              aria-pressed={form.free === null && form.topic === c.topic} onClick={() => pickTopic(c.topic)}>
              {c.label}
            </button>
          ))}
          <button type="button" className={styles.chip} aria-pressed={form.free !== null} onClick={pickFree}>직접 쓰기</button>
        </div>
        {form.free !== null && (
          <>
            <input
              ref={freeInput}
              className={styles.input}
              aria-label="직접 쓰기"
              data-amp-mask
              maxLength={GOAL_MAX}
              placeholder={FREE_PLACEHOLDER}
              value={form.free}
              onChange={(e) => {
                const free = e.target.value;
                setForm((f) => ({ ...f, free }));
                setMissing(false);
              }}
            />
            <p className={styles.hint}>
              주제나 고민을 적어 주세요 · 제목·작가로 찾을 땐{" "}
              <a href={YES24_HOME} target="_blank" rel="noopener noreferrer">예스24 검색을 이용해 주세요 ↗</a>
            </p>
            <p className={styles.hint}>
              <span>이름·연락처는 적지 마세요</span> · <Link href="/privacy" className={styles.policy}>처리방침</Link>
            </p>
          </>
        )}
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
