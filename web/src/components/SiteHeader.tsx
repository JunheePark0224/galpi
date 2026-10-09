import { AccountButton } from "./account/AccountButton";
import { HomeLink } from "./HomeLink";
import { Logo } from "./Logo";
import styles from "./SiteHeader.module.css";

/**
 * Small logo header on every screen (DESIGN A-05). The logo is a plain `<a>` home — a real navigation, so the flow starts at
 * S-01 (see loadFlow). Top right: [처음으로] (10-09, HomeLink — hidden at S-01) then [로그인] / [내 책갈피 N] (P5, AccountButton).
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full navigation on purpose: the flow starts at S-01 */}
      <a href="/" className={styles.home} aria-label="갈피 처음 화면">
        <Logo className={styles.logo} />
      </a>
      <div className={styles.actions}>
        <HomeLink />
        <AccountButton />
      </div>
    </header>
  );
}
