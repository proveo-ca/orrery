import clsx from "clsx";
import type { Component } from "solid-js";
import { Show } from "solid-js";

import { Button } from "~/components/common/Button";
import styles from "~/components/common/ColorSelector.module.css";
import { DiceIcon } from "~/components/common/icons";
import type { PlayerColorPref } from "~/store/settingsStore.ts";

interface Props {
  value: PlayerColorPref;
  onChange: (val: PlayerColorPref) => void;
  hideRandom?: boolean;
}

export const ColorSelector: Component<Props> = (props) => {
  return (
    <div class={styles["color-selector"]}>
      <Button
        class={clsx(props.value === "w" && styles.active)}
        onClick={() => props.onChange("w")}
      >
        White
      </Button>
      <Show when={!props.hideRandom}>
        <Button
          class={clsx(props.value === "random" && styles.active)}
          onClick={() => props.onChange("random")}
          aria-label="Random"
        >
          <DiceIcon />
        </Button>
      </Show>
      <Button
        class={clsx(props.value === "b" && styles.active)}
        onClick={() => props.onChange("b")}
      >
        Black
      </Button>
    </div>
  );
};
