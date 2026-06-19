import clsx from "clsx";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/primitives/Button.tsx";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/primitives/icons";
import styles from "~/components/primitives/DualNavButton.module.css";

interface DualNavButtonProps {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  inverted?: boolean;
  label?: string;
  showBackToLive?: boolean;
  onBackToLive?: () => void;
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
      <Show when={props.showBackToLive}>
        <Button
          class={styles["back-to-live"]}
          onClick={() => props.onBackToLive?.()}
          disabled={!props.onBackToLive}
        >
          Back to Live
        </Button>
      </Show>
    </div>
  );
};
