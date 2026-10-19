"use client";
import { useSyncExternalStore } from "react";
import { isSoundOn, setSoundOn, subscribeSound } from "@/lib/sound/pageSound";
import { track } from "@/lib/track/client";
import styles from "./SoundButton.module.css";

/** The toggle's name stays the same; aria-pressed says whether the sound is on (WCAG 4.1.2). */
export const SOUND_LABEL = "책장 소리";

/**
 * DESIGN C-34 (10-19): a quiet round speaker at the book scene's top right — on the closed book, the first page and the
 * bookmarks, never on the back cover. Pressed = sound on (the default). The server renders it "on"; the browser's own
 * choice follows right after hydration.
 */
export function SoundButton() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  const toggle = () => {
    setSoundOn(!on);
    track("sound_toggle_clicked", { is_sound_on: !on });
  };
  return (
    <button type="button" className={styles.sound} aria-label={SOUND_LABEL} aria-pressed={on} title={on ? "소리 끄기" : "소리 켜기"} onClick={toggle}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on
          ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
