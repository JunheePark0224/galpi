"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canShareImages, storyFile } from "@/lib/share/storyFile";
import { useBackToClose } from "@/lib/nav/useBackToClose";
import { detectDevice } from "@/lib/track/common";
import styles from "./ShareSheet.module.css";

export const SHEET_TITLE = "결과 공유하기";
export const COPIED = "링크를 복사했어요";
export const COPY_FAILED = "링크를 복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요";
export const IMAGE_FAILED = "이미지를 공유하지 못했어요";
export const INAPP_HINT = "이미지를 길게 눌러 저장한 뒤 인스타 스토리에 올려 주세요";
/** 10-08 (user): an in-app browser can hand the page to the phone's browser itself — there the story share is one tap. */
export const OUTSIDE_HINT = "오른쪽 위 ⋯ 메뉴에서 \"외부 브라우저에서 열기\"를 누르면 스토리로 바로 공유할 수 있어요";
/** 10-09 시안 A-2: a story picture carries no link — the tile copies this result's link and says how to stick it on. */
export const STORY_COPIED = "내 결과 링크를 복사했어요";
export const STORY_COPY_FAILED = "링크를 복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요";
export const STORY_STEPS = ["스토리에 이미지를 올리고", "위쪽 스티커에서 🔗 링크를 골라", "붙여 넣으면 친구가 내 결과를 볼 수 있어요"] as const;
export const STORY_SEND = "스토리로 보내기";
const shareText = (n: number) => `오늘 갈피에서 책갈피 ${n}장을 만났어요. 나도 갈피 잡으러 가기`;

export type ShareMethod = "native" | "copy" | "image" | "save_image";
type Status = "" | "copied" | "copy_failed" | "image_failed";
const STATUS: Record<Status, string> = { "": "", copied: COPIED, copy_failed: COPY_FAILED, image_failed: IMAGE_FAILED };

/** What this browser can do with the picture: share the file (Instagram story …), only save it, or neither (in-app). */
type Mode = "files" | "save" | "hold";

interface Props {
  shareUrl: string;
  count: number;
  onClose: () => void;
  /** E-42: `isLinkCopied` — for "image", whether the result link went to the clipboard first (v2.4); null otherwise. */
  onShared: (method: ShareMethod, isLinkCopied: boolean | null) => void;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Not the app's name but what the browser does (10-07): can it hand a picture to the share sheet? */
function modeOf(): Mode {
  if (canShareImages()) return "files";
  return detectDevice(navigator.userAgent).is_in_app_browser ? "hold" : "save";
}

/**
 * C-31 공유 시트 (F-27, 사용자 시안 10-07): the story image (C-30) as a preview, then [인스타 스토리로] (the picture to the
 * share sheet — Instagram offers its story), [이미지 저장] and [링크 공유] (the share sheet, or the link copied). An in-app
 * browser that can neither share nor download the picture gets a big preview to hold and save, and [링크 복사].
 * The picture is usually in hand already (the S-11 buttons asked for it as the book shut — lib/share/storyFile); till
 * then [인스타 스토리로] keeps its place, greyed, "준비 중…" (10-08). [인스타 스토리로] first copies this result's link and
 * turns the sheet into three steps (sticking it on the story as a 🔗 link) with [스토리로 보내기] — the picture goes on
 * that second tap, as the tap itself (10-09 시안 A-2). Shows only — the caller sends E-42 through onShared.
 */
export function ShareSheet({ shareUrl, count, onClose, onShared }: Props) {
  const [mode] = useState(modeOf);
  const [status, setStatus] = useState<Status>("");
  // undefined: still coming; null: it did not come (the tile goes, saving and the link still work)
  const [image, setImage] = useState<File | null | undefined>(undefined);
  // the story steps (10-09): null = the tiles; else whether the link reached the clipboard
  const [steps, setSteps] = useState<{ copied: boolean } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const story = `${new URL(shareUrl).pathname}/story`;
  useBackToClose(onClose);   // the phone's back key closes the sheet, not the page (10-08)

  // a modal: focus starts on the title and Tab stays in the sheet, Esc closes, the page behind does not scroll
  useEffect(() => {
    title.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheet.current) return;
      const stops = [...sheet.current.querySelectorAll<HTMLElement>("button, a[href], input")];
      const [first, last] = [stops[0], stops[stops.length - 1]];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === title.current)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (mode !== "files") return;
    let live = true;
    void storyFile(story).then((file) => { if (live) setImage(file); });
    return () => { live = false; };
  }, [mode, story]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      onShared("copy", null);
    } catch {
      setStatus("copy_failed");
    }
  };
  const shareLink = async () => {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: "갈피", text: shareText(count), url: shareUrl });
      onShared("native", null);
    } catch (err) {
      if (!isAbort(err)) await copy();
    }
  };
  const toStory = async () => {
    setStatus("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSteps({ copied: true });
    } catch {
      setSteps({ copied: false });   // the picture can still go: the link is shown to copy by hand
    }
  };
  const shareImage = async (file: File, copied: boolean) => {
    try {
      await navigator.share({ files: [file] });
      onShared("image", copied);
      setSteps(null);
    } catch (err) {
      if (!isAbort(err)) setStatus("image_failed");
    }
  };

  // on document.body: the S-11 buttons pop in with a transform, which would hold a fixed layer inside them
  return createPortal(
    <div className={styles.layer}>
      <div className={styles.backdrop} data-backdrop="" onClick={onClose} />
      <div ref={sheet} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
        <span className={styles.grab} aria-hidden="true" />
        <h2 id="share-sheet-title" ref={title} tabIndex={-1} className={styles.title}>{SHEET_TITLE}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- the server-drawn story image, held to save in an in-app browser */}
        <img className={mode === "hold" ? styles.storyBig : styles.story} src={story} alt="스토리 이미지 미리보기" />
        {mode === "hold" && <p className={styles.hint}>{INAPP_HINT}</p>}
        {mode === "hold" && <p className={styles.outside}>{OUTSIDE_HINT}</p>}
        {steps && image && (
          <>
            <div className={styles.steps}>
              <p className={styles.stepsHead}>{steps.copied ? `✓ ${STORY_COPIED}` : STORY_COPY_FAILED}</p>
              {!steps.copied && (
                <input className={styles.url} aria-label="공유 링크" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
              )}
              <ol className={styles.stepList}>{STORY_STEPS.map((t) => <li key={t}>{t}</li>)}</ol>
            </div>
            <button type="button" className={styles.send} onClick={() => { void shareImage(image, steps.copied); }}>
              <span aria-hidden="true">◎</span> {STORY_SEND}
            </button>
          </>
        )}
        {!steps && <div className={styles.tiles}>
          {mode === "files" && image !== null && (
            <button
              type="button"
              className={styles.tile}
              disabled={!image}
              aria-busy={!image || undefined}
              onClick={() => { if (image) void toStory(); }}
            >
              <span className={`${styles.icon} ${styles.insta}`} aria-hidden="true">◎</span>
              {image ? "인스타 스토리로" : "준비 중…"}
            </button>
          )}
          {mode !== "hold" && (
            <a className={styles.tile} href={story} download="galpi-bookmarks.png" onClick={() => onShared("save_image", null)}>
              <span className={`${styles.icon} ${styles.save}`} aria-hidden="true">↓</span>이미지 저장
            </a>
          )}
          <button type="button" className={styles.tile} onClick={() => { void (mode === "hold" ? copy() : shareLink()); }}>
            <span className={`${styles.icon} ${styles.link}`} aria-hidden="true">🔗</span>{mode === "hold" ? "링크 복사" : "링크 공유"}
          </button>
        </div>}
        <p className={styles.status} role="status">{STATUS[status]}</p>
        {status === "copy_failed" && (
          <input className={styles.url} aria-label="공유 링크" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
        )}
        {steps
          ? <button type="button" className={styles.close} onClick={() => { setSteps(null); setStatus(""); }}>돌아가기</button>
          : <button type="button" className={styles.close} onClick={onClose}>닫기</button>}
      </div>
    </div>,
    document.body,
  );
}
