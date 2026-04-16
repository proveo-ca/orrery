import { A } from "@solidjs/router";
import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "~/components/common/Button.module.css";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary-color background. */
  primary?: boolean;
  /** When set, renders a router `<A>` instead of a `<button>`. */
  href?: string;
}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["class", "primary", "href", "children"]);
  const cls = () =>
    clsx(styles["common-btn"], local.primary && styles["common-btn--primary"], local.class);

  if (local.href != null) {
    return (
      <A class={cls()} href={local.href}>
        {local.children}
      </A>
    );
  }

  return (
    <button class={cls()} {...others}>
      {local.children}
    </button>
  );
}

/**
 * @deprecated Use `<Button href="...">` instead.
 */
export const ButtonLink = Button;
