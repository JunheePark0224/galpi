"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { detectDevice } from "@/lib/track/common";
import styles from "./ShareSheet.module.css";

export const SHEET_TITLE = "결과 공유하기";
export const COPIED = "링크를 복사했어요";
export const COPY_FAILED = "링크를 복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요";
export const IMAGE_FAILED = "이미지를 공유하지 못했어요";
export const INAPP_HINT = "이미지를 길게 눌러 저장한 뒤 인스타 스토리에 올려 주세요";
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
  onShared: (method: ShareMethod) => void;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Not the app's name but what the browser does (10-07): can it hand a picture to the share sheet? */
function modeOf(): Mode {
  const probe = new File([new Uint8Array(1)], "x.png", { type: "image/png" });   // not empty: some browsers refuse an empty file
  const files = typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  if (files) return "files";
  return detectDevice(navigator.userAgent).is_in_app_browser ? "hold" : "save";
}

/**
 * C-31 공유 시트 (F-27, 사용자 시안 10-07): the story image (C-30) as a preview, then [인스타 스토리로] (the picture to the
 * share sheet — Instagram offers its story), [이미지 저장] and [링크 공유] (the share sheet, or the link copied). An in-app
 * browser that can neither share nor download the picture gets a big preview to hold and save, and [링크 복사].
 * The picture is fetched when the sheet opens, so the share can start right on the next tap. Shows only — the caller
 * sends E-42 through onShared.
 */
export function ShareSheet({ shareUrl, count, onClose, onShared }: Props) {
  const [mode] = useState(modeOf);
  const [status, setStatus] = useState<Status>("");
  const [image, setImage] = useState<File | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const story = `${new URL(shareUrl).pathname}/story`;

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
    fetch(story)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`story ${res.status}`))))
      .then((blob) => { if (live) setImage(new File([blob], "galpi-bookmarks.png", { type: "image/png" })); })
      .catch(() => { /* no picture, no [인스타 스토리로] — saving and the link still work */ });
    return () => { live = false; };
  }, [mode, story]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      onShared("copy");
    } catch {
      setStatus("copy_failed");
    }
  };
  const shareLink = async () => {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: "갈피", text: shareText(count), url: shareUrl });
      onShared("native");
    } catch (err) {
      if (!isAbort(err)) await copy();
    }
  };
  const shareImage = async (file: File) => {
    try {
      await navigator.share({ files: [file] });
      onShared("image");
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
        <div className={styles.tiles}>
          {mode === "files" && image && (
            <button type="button" className={styles.tile} onClick={() => { void shareImage(image); }}>
              <span className={`${styles.icon} ${styles.insta}`} aria-hidden="true">◎</span>인스타 스토리로
            </button>
          )}
          {mode !== "hold" && (
            <a className={styles.tile} href={story} download="galpi-bookmarks.png" onClick={() => onShared("save_image")}>
              <span className={`${styles.icon} ${styles.save}`} aria-hidden="true">↓</span>이미지 저장
            </a>
          )}
          <button type="button" className={styles.tile} onClick={() => { void (mode === "hold" ? copy() : shareLink()); }}>
            <span className={`${styles.icon} ${styles.link}`} aria-hidden="true">🔗</span>{mode === "hold" ? "링크 복사" : "링크 공유"}
          </button>
        </div>
        <p className={styles.status} role="status">{STATUS[status]}</p>
        {status === "copy_failed" && (
          <input className={styles.url} aria-label="공유 링크" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
        )}
        <button type="button" className={styles.close} onClick={onClose}>닫기</button>
      </div>
    </div>,
    document.body,
  );
}
