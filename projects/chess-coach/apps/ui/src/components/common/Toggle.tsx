import type { Component } from "solid-js";

import "~/components/common/Toggle.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: Component<ToggleProps> = (props) => {
  return (
    <div class="toggle-container">
      {props.label && <span class="toggle-label">{props.label}</span>}
      <label class="switch">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
        />
        <span class="slider round"></span>
      </label>
    </div>
  );
};
