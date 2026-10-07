"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import buttonStyles from "@/components/Button.module.css";
import { isKakaoInApp, mineUrl, openOutside } from "@/lib/share/inapp";
import styles from "./BackCover.module.css";

export const SHARE = "공유하기";
export const COPIED = "링크를 복사했어요";
export const COPY_FAILED = "링크를 복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요";
export const OPEN_OUTSIDE = "브라우저에서 열어 공유하기";
export const SHARE_IMAGE = "이미지로 공유";
export const IMAGE_FAILED = "이미지를 공유하지 못했어요";
export const KAKAO_NOTE = "카카오톡 안에서는 공유창이 열리지 않아서 브라우저로 열어요";
const shareText = (n: number) => `오늘 갈피에서 책갈피 ${n}장을 만났어요. 나도 갈피 잡으러 가기`;

export type ShareMethod = "native" | "copy" | "image";
type Status = "" | "copied" | "copy_failed" | "image_failed";
const STATUS: Record<Status, string> = { "": "", copied: COPIED, copy_failed: COPY_FAILED, image_failed: IMAGE_FAILED };

interface Props {
  shareUrl: string;
  count: number;
  /** S-11 has [책 정보 보기] as its main button; on the person's own page in the browser, sharing is the main thing. */
  variant: "primary" | "secondary";
  /** S-11 inside KakaoTalk hands over to the phone's browser; the page it hands over to never hands over again. */
  handOver: boolean;
  onShared: (method: ShareMethod) => void;
}

const noSubscribe = () => () => {};

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Can this browser hand a picture to the share sheet (Instagram story · feed · DM …)? Desktop browsers mostly cannot. */
function canShareImages(): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([], "x.png", { type: "image/png" })] });
}

/**
 * The share actions under a 뒤표지 (F-27): [공유하기] opens the phone's share sheet with the link, or copies the link where
 * there is none (a refused clipboard shows the link to copy by hand). [이미지로 공유] hands the story image itself to the
 * share sheet — Instagram then offers its story — and shows only once the image is here, where files can be shared (the
 * share must start right on the tap, so the picture is fetched beforehand). No saving (사용자 결정 10-07). Inside KakaoTalk —
 * no share sheet, no downloads — S-11 instead opens the person's own back cover in the phone's browser (lib/share/inapp).
 */
export function ShareActions({ shareUrl, count, variant, handOver, onShared }: Props) {
  const [status, setStatus] = useState<Status>("");
  const [image, setImage] = useState<File | null>(null);
  const inKakao = useSyncExternalStore(noSubscribe, () => isKakaoInApp(navigator.userAgent), () => false);
  const handingOver = inKakao && handOver;
  const story = `${new URL(shareUrl).pathname}/story`;

  useEffect(() => {
    // the UA is read here too: on the first pass after hydration inKakao is still false
    if (handingOver || (handOver && isKakaoInApp(navigator.userAgent)) || !canShareImages()) return;
    let live = true;
    fetch(story)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`story ${res.status}`))))
      .then((blob) => { if (live) setImage(new File([blob], "galpi-bookmarks.png", { type: "image/png" })); })
      .catch(() => { /* no picture, no [이미지로 공유] — the link still shares */ });
    return () => { live = false; };
  }, [handingOver, handOver, story]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      onShared("copy");
    } catch {
      setStatus("copy_failed");
    }
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "갈피", text: shareText(count), url: shareUrl });
        onShared("native");
      } catch (err) {
        if (!isAbort(err)) await copy();
      }
      return;
    }
    await copy();
  };
  const shareImage = async (file: File) => {
    try {
      await navigator.share({ files: [file] });
      onShared("image");
    } catch (err) {
      if (!isAbort(err)) setStatus("image_failed");
    }
  };

  if (handingOver) {
    return (
      <>
        <a
          className={[buttonStyles.btn, buttonStyles.link, buttonStyles[variant]].join(" ")}
          data-variant={variant}
          href={openOutside(mineUrl(shareUrl))}
        >
          <span aria-hidden="true">↗ </span>{OPEN_OUTSIDE}
        </a>
        <p className={styles.status}>{KAKAO_NOTE}</p>
      </>
    );
  }
  return (
    <>
      <div className={styles.shareRow}>
        <Button variant={variant} onClick={() => { void share(); }}>
          <span aria-hidden="true">↗ </span>{SHARE}
        </Button>
        {image && <Button variant="secondary" onClick={() => { void shareImage(image); }}>{SHARE_IMAGE}</Button>}
      </div>
      <p className={styles.status} role="status">{STATUS[status]}</p>
      {status === "copy_failed" && (
        <input className={styles.link} aria-label="공유 링크" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
      )}
    </>
  );
}
