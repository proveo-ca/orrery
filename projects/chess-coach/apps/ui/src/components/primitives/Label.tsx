import clsx from "clsx";
import { Show } from "solid-js";
import type { JSX } from "solid-js";

import styles from "~/components/primitives/Label.module.css";

type LabelVariant = "muted" | "caption" | "section" | "title";
type LabelColor = "win" | "loss" | "draw" | string;

interface LabelProps {
  variant?: LabelVariant;
  color?: LabelColor;
  class?: string;
  children: JSX.Element;
}

export function Label(props: LabelProps) {
  const variant = () => props.variant ?? "muted";
  const color = () => props.color;
  const cls = () => clsx(styles.label, styles[variant()], color() && styles[color()!], props.class);

  return (
    <Show when={variant() === "section"} fallback={<span class={cls()}>{props.children}</span>}>
      <p class={cls()}>{props.children}</p>
    </Show>
  );
}
