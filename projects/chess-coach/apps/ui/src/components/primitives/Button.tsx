import { A } from "@solidjs/router";
import clsx from "clsx";
import { splitProps } from "solid-js";

import styles from "~/components/primitives/Button.module.css";
import type { ButtonProps } from "~/types/ui";

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, [
    "class",
    "primary",
    "href",
    "target",
    "rel",
    "children",
  ]);
  const cls = () =>
    clsx(styles["common-btn"], local.primary && styles["common-btn--primary"], local.class);

  if (local.href != null) {
    // Router <A> is for in-app routes; external URLs (or any target) get a native <a>.
    const external = local.target != null || /^[a-z][a-z0-9+.-]*:/i.test(local.href);
    if (external) {
      return (
        <a class={cls()} href={local.href} target={local.target} rel={local.rel}>
          {local.children}
        </a>
      );
    }
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
