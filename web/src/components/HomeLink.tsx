"use client";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { goFlowHome, useFlowAway } from "@/lib/nav/homeLink";
import styles from "./account/AccountButton.module.css";

/**
 * Header [처음으로] beside [로그인]/[내 책갈피 N] (10-09, D안, PRD F-01): straight to S-01, no confirmation. On / it shows
 * only while the flow is away from S-01 and runs the flow's own home (E-20 source=header, a new round, no page load);
 * on other pages it is a plain link to / like the logo (no event — the flow there starts fresh).
 */
export function HomeLink() {
  const onFlowPage = usePathname() === "/";
  const away = useFlowAway();
  if (onFlowPage && !away) return null;
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onFlowPage || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab: the browser's
    if (!goFlowHome()) return;
    e.preventDefault();
    // this link goes away at S-01: keep the keyboard on the header's logo, not lost on the page
    document.querySelector<HTMLElement>("header a")?.focus();
  };
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- off the flow page, a full navigation like the logo
    <a href="/" className={styles.account} onClick={click}>
      <span className={styles.label}>처음으로</span>
    </a>
  );
}
