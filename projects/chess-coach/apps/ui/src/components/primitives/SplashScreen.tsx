// SPEC: _spec/chess-coach/ui/components.puml
import { type Component, type JSX, Show } from "solid-js";

import styles from "~/components/primitives/SplashScreen.module.css";

interface SplashScreenProps {
  /** Optional heading shown above the content. */
  title?: string;
  /** Optional avatar/illustration rendered in the centered avatar slot. */
  avatar?: JSX.Element;
  /** Render as a fixed, full-viewport backdrop (used by LoadingOverlay). */
  fullscreen?: boolean;
  /** Inline styles applied to the fullscreen backdrop (e.g. opacity transition). */
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

/**
 * Shared splash layout shell: a centered content column with an optional
 * avatar slot and title. Composed by MenuScreen, LanScreen and LoadingOverlay
 * so the splash chrome lives in exactly one place (and one stylesheet).
 */
export const SplashScreen: Component<SplashScreenProps> = (props) => {
  const content = (
    <div class={styles["splash-content"]}>
      <Show when={props.avatar}>
        <div class={styles["splash-avatar-wrapper"]}>{props.avatar}</div>
      </Show>
      <Show when={props.title}>
        <h2 class={styles["splash-title"]}>{props.title}</h2>
      </Show>
      {props.children}
    </div>
  );

  return (
    <Show when={props.fullscreen} fallback={content}>
      <div class={styles["splash-screen"]} style={props.style}>
        {content}
      </div>
    </Show>
  );
};
