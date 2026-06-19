import clsx from "clsx";
import { Show, splitProps } from "solid-js";

import { Button } from "~/components/primitives/Button";
import styles from "~/components/primitives/IconButton.module.css";
import type { ButtonProps } from "~/types/ui";

export interface IconButtonProps extends ButtonProps {
  label?: string;
  labelPosition?: "top" | "bottom";
}

export function IconButton(props: IconButtonProps) {
  const [local, others] = splitProps(props, ["class", "children", "label", "labelPosition"]);

  const btn = (
    <Button class={clsx(styles["icon-btn"], local.class)} {...others}>
      {local.children}
    </Button>
  );

  return (
    <Show when={local.label} fallback={btn}>
      <div class={styles.labeled}>
        <Show when={local.labelPosition !== "bottom"}>
          <span class={styles.label}>{local.label}</span>
        </Show>
        {btn}
        <Show when={local.labelPosition === "bottom"}>
          <span class={styles.label}>{local.label}</span>
        </Show>
      </div>
    </Show>
  );
}
