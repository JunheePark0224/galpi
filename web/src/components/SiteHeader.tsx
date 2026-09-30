import { Logo } from "./Logo";
import styles from "./SiteHeader.module.css";

/** Small logo header on every screen (DESIGN A-05). No login place until P5: a button that does nothing would confuse. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Logo className={styles.logo} />
    </header>
  );
}
