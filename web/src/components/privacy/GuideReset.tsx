"use client";
import { useState } from "react";
import { resetGuides } from "@/lib/flow/firstGuide";
import styles from "./GuideReset.module.css";

export const GUIDE_AGAIN = "책갈피 보는 법 다시 보기";
export const GUIDE_AGAIN_DONE = "다음에 만나는 첫 책갈피에서 다시 보여 드릴게요";

/** C-20 · C-21: the S-05 and S-06 guides show again on the next first bookmark and the next first S-06 book. */
export function GuideReset() {
  const [done, setDone] = useState(false);
  return done
    ? <p className={styles.done} role="status">{GUIDE_AGAIN_DONE}</p>
    : <button type="button" className={styles.again} onClick={() => { resetGuides(); setDone(true); }}>{GUIDE_AGAIN}</button>;
}
