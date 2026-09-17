import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
  active?: boolean;
};

/**
 * テキストとアイコンを同じ見た目で並べるボタン
 * @param props
 * @returns
 */
export function Button({
  variant = "default",
  active = false,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <button
      type={type}
      className={classes}
      data-variant={variant}
      data-active={active}
      {...props}
    >
      {children}
    </button>
  );
}
