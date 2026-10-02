"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { FEEDBACK_MAX } from "@/lib/feedback/letter";
import { sendFeedback } from "@/lib/feedback/send";
import { MailSlot } from "./MailSlot";
import styles from "./Mailbox.module.css";

const TITLE = "갈피 우체통";
/** Contains the visible words (WCAG 2.5.3 — a voice user can say what they see). */
const LABEL = "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요";
const EMPTY = "느낀 점을 한 줄이라도 적어 주세요.";
const FAILED = "보내지 못했어요. 잘 안 되면 잠시 뒤에 다시 해 주세요.";

/**
 * S-01 PRD F-26 / DESIGN C-18: a small, quiet brass letter slot under the two entries. It opens the letter sheet.
 * Kept secondary on purpose — the eye goes to the entries first.
 */
export function Mailbox() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.post}>
      <button type="button" className={styles.slot} aria-label={LABEL} onClick={() => setOpen(true)}>
        <MailSlot className={styles.plate} />
        <span className={styles.name} aria-hidden="true">{TITLE}</span>
        <span className={styles.line} aria-hidden="true">써 보고 느낀 점을 넣어 주세요</span>
      </button>
      {open && <LetterSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * The sheet. The letter lives only in the textarea (uncontrolled): never in React state, a DOM attribute, an analytics prop
 * or a log — only the length is kept for the counter. The field sits in data-amp-mask so Session Replay hides it.
 */
function LetterSheet({ onClose }: { onClose: () => void }) {
  const fieldId = useId();
  const countId = useId();
  const noteId = useId();
  const messageId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const thanks = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [length, setLength] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The thanks is read out by moving focus to it (a status region mounted already filled may stay silent).
  useEffect(() => { if (done) thanks.current?.focus(); }, [done]);
  // While the letter is on its way the sheet stays open: closing then would hide the answer and invite a second send.
  const close = () => { if (!busy.current) onClose(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const text = field.current?.value ?? "";
    if (!text.trim()) {
      setMessage(EMPTY);
      field.current?.focus();
      return;
    }
    busy.current = true;
    setSending(true);
    setMessage(null);
    const sent = await sendFeedback(text);
    busy.current = false;
    setSending(false);
    if (sent) setDone(true);
    else setMessage(FAILED);   // the letter stays in the field
  };

  return (
    <Sheet title={TITLE} onClose={close}>
      {done ? (
        <div className={styles.done}>
          <MailSlot className={styles.doneSlot} dropped />
          <div ref={thanks} className={styles.thanks} tabIndex={-1} data-testid="mailbox-thanks">
            <p className={styles.thanksTitle}>고마워요, 잘 받았어요</p>
            <p className={styles.thanksLine}>하나하나 읽어 볼게요.</p>
          </div>
          <Button variant="secondary" className={styles.wide} onClick={onClose}>닫기</Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <p className={styles.lead}>불편했던 곳, 좋았던 책, 한 줄이어도 정말 큰 도움이 돼요.</p>
          <div data-amp-mask="">
            <label htmlFor={fieldId} className={styles.srOnly}>써 보고 느낀 점</label>
            <textarea
              ref={field}
              id={fieldId}
              className={styles.field}
              maxLength={FEEDBACK_MAX}
              rows={5}
              placeholder="여기에 적어 주세요"
              aria-describedby={[countId, noteId, message ? messageId : null].filter(Boolean).join(" ")}
              aria-invalid={message === EMPTY}
              onChange={(e) => {
                setLength(e.currentTarget.value.length);
                if (message === EMPTY) setMessage(null);
              }}
            />
          </div>
          <p id={countId} className={styles.count}>{length} / {FEEDBACK_MAX}</p>
          <p id={noteId} className={styles.note}>이름·연락처는 적지 마세요. 적은 글은 갈피 저장소에만 보관해요.</p>
          {message && <p id={messageId} role="alert" className={styles.message}>{message}</p>}
          <Button type="submit" className={styles.wide} aria-disabled={sending || undefined} aria-busy={sending || undefined}>
            {sending ? "넣는 중…" : "넣기"}
          </Button>
          {/* a reachable close for touch screen readers (the backdrop is hidden from them); waits while sending */}
          <button type="button" className={styles.textClose} aria-disabled={sending || undefined} onClick={close}>닫기</button>
        </form>
      )}
    </Sheet>
  );
}
