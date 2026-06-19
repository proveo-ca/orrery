// SPEC: _spec/chess-coach/ui/components.puml
import { A } from "@solidjs/router";
import type { Component } from "solid-js";

import { SplashScreen } from "~/components/primitives/SplashScreen";
import styles from "~/screens/LanScreen.module.css";

export const LanScreen: Component = () => {
  return (
    <SplashScreen title="Play LAN">
      <p class={styles["coming-soon"]}>Coming soon!</p>
      <A href="/" style={{ "margin-top": "1rem", "text-align": "center" }}>
        Back to Menu
      </A>
    </SplashScreen>
  );
};
