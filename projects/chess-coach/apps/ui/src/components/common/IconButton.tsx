import clsx from "clsx";
import { type JSX, Show, splitProps } from "solid-js";

import { Button } from "~/components/common/Button";
import styles from "~/components/common/IconButton.module.css";

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
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
