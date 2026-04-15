import clsx from "clsx";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button.tsx";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/common/icons";
import styles from "~/components/DualNavButton.module.css";

interface DualNavButtonProps {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  inverted?: boolean;
  label?: string;
}

export const DualNavButton: Component<DualNavButtonProps> = (props) => {
  return (
    <div class={styles.wrapper}>
      <Show when={props.label}>
        <span class={styles.label}>{props.label}</span>
      </Show>
      <div class={clsx(styles["dual-nav"], props.inverted && styles.inverted)}>
        <Button
          class={clsx(styles.half, styles.left)}
          onClick={props.onBack}
          disabled={props.backDisabled}
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          class={styles.half}
          onClick={props.onForward}
          disabled={props.forwardDisabled}
          aria-label="Go forward"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
};
