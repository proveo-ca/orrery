import { A } from "@solidjs/router";
import type { Component } from "solid-js";

import styles from "~/components/common/SplashScreen.module.css";

export const LanScreen: Component = () => {
  return (
    <div class={styles["splash-content"]}>
      <h2 class={styles["splash-title"]}>Play LAN</h2>
      <p class={styles["coming-soon"]}>Coming soon!</p>
      <A
        href="/"
        class={styles["menu-btn"]}
        style={{ "margin-top": "1rem", "text-align": "center" }}
      >
        Back to Menu
      </A>
    </div>
  );
};
