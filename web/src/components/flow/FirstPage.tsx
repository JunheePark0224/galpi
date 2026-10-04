import { LogoMark } from "@/components/Logo";
import styles from "./FirstPage.module.css";

/** S-04 left page (inside of the cover): the chapter title, like a book's first page (DESIGN C-10 v2). */
export function FirstPageTitle() {
  return (
    <div className={styles.titlePage}>
      <LogoMark className={styles.ornament} width={32} />
      <h2 className={styles.title}>당신이 고른 길</h2>
    </div>
  );
}
