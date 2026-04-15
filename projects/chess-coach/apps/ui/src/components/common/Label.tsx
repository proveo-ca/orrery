import clsx from "clsx";
import { Show } from "solid-js";
import type { JSX } from "solid-js";

import styles from "~/components/common/Label.module.css";

type LabelVariant = "muted" | "caption" | "section";

interface LabelProps {
  variant?: LabelVariant;
  class?: string;
  children: JSX.Element;
}

export function Label(props: LabelProps) {
  const variant = () => props.variant ?? "muted";
  const cls = () => clsx(styles.label, styles[variant()], props.class);

  return (
    <Show when={variant() === "section"} fallback={<span class={cls()}>{props.children}</span>}>
      <p class={cls()}>{props.children}</p>
    </Show>
  );
}
