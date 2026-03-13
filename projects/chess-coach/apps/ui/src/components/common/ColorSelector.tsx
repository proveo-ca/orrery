import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import type { PlayerColorPref } from "~/store/settingsStore.ts";
import "~/components/common/ColorSelector.css";

interface Props {
  value: PlayerColorPref;
  onChange: (val: PlayerColorPref) => void;
}

export const ColorSelector: Component<Props> = (props) => {
  return (
    <div class="color-selector">
      <Button class={props.value === "w" ? "active" : ""} onClick={() => props.onChange("w")}>
        White
      </Button>
      <Button
        class={props.value === "random" ? "active" : ""}
        onClick={() => props.onChange("random")}
      >
        Random
      </Button>
      <Button class={props.value === "b" ? "active" : ""} onClick={() => props.onChange("b")}>
        Black
      </Button>
    </div>
  );
};
