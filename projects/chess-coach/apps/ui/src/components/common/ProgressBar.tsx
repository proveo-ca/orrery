import { type Component } from "solid-js";

import "~/components/common/ProgressBar.css";

interface ProgressBarProps {
  progress: number;
  text?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  // Ensure progress stays between 0 and 100 for the CSS width
  const clampedProgress = () => Math.max(0, Math.min(100, props.progress));

  return (
    <div class="progress-wrapper">
      <div class="progress-container">
        <div class="progress-bar" style={{ width: `${clampedProgress()}%` }}></div>
      </div>
      {props.text && <p class="progress-text">{props.text}</p>}
    </div>
  );
};
