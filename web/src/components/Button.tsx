import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Ref } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary";
// React 19: `ref` is a plain prop, passed on to the <button> with the rest (S-11 returns focus to [결과 공유하기])
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; ref?: Ref<HTMLButtonElement> };

export function Button({ variant = "primary", className, type = "button", ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      data-variant={variant}
      className={[styles.btn, styles[variant], className].filter(Boolean).join(" ")}
    />
  );
}

/** C-05 look for a link that leaves the site (S-06 [예스24에서 보기]): opens a new tab, never passes our page as opener. */
export function LinkButton({ variant = "primary", className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a
      {...rest}
      target="_blank"
      rel="noopener noreferrer"
      data-variant={variant}
      className={[styles.btn, styles.link, styles[variant], className].filter(Boolean).join(" ")}
    />
  );
}
