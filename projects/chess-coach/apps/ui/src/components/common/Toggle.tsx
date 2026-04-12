import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/common/Toggle.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: Component<ToggleProps> = (props) => {
  return (
    <div class={styles["toggle-container"]}>
      {props.label && <span class={styles["toggle-label"]}>{props.label}</span>}
      <label class={styles.switch}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
        />
        <span class={clsx(styles.slider, styles.round)}></span>
      </label>
    </div>
  );
};
