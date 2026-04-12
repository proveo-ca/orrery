import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/DualNavButton.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/icons";

interface DualNavButtonProps {
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  inverted?: boolean;
}

export const DualNavButton: Component<DualNavButtonProps> = (props) => {
  return (
    <div class={clsx(styles["dual-nav"], props.inverted && styles.inverted)}>
      <button
        class={clsx(styles.half, styles.left)}
        onClick={props.onBack}
        disabled={props.backDisabled}
        aria-label="Go back"
      >
        <ChevronLeftIcon />
      </button>
      <button
        class={styles.half}
        onClick={props.onForward}
        disabled={props.forwardDisabled}
        aria-label="Go forward"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
};
