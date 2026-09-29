import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

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
