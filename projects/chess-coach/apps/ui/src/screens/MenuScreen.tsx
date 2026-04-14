import { useNavigate } from "@solidjs/router";
import clsx from "clsx";
import type { Component } from "solid-js";

import { CoachAvatar } from "~/components/CoachAvatar";
import { Select } from "~/components/common/Select";
import styles from "~/components/common/SplashScreen.module.css";
import {
  playerIdentity,
  setPlayerIdentity,
  type PlayerIdentity,
} from "~/store/settingsStore";

const IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

export const MenuScreen: Component = () => {
  const navigate = useNavigate();

  return (
    <div class={styles["splash-content"]}>
      <div class={styles["splash-avatar-wrapper"]}>
        <CoachAvatar />
      </div>
      <h2 class={styles["splash-title"]}>Wanna play Chess?</h2>
      <div class={styles["identity-row"]}>
        <label class={styles["identity-label"]} for="player-identity">
          I am:
        </label>
        <Select
          id="player-identity"
          value={playerIdentity()}
          onChange={(e) => setPlayerIdentity(e.currentTarget.value as PlayerIdentity)}
        >
          {IDENTITY_OPTIONS.map((id) => (
            <option value={id}>{id}</option>
          ))}
        </Select>
      </div>
      <div class={styles["menu-options"]}>
        <button
          class={clsx(styles["menu-btn"], styles["menu-btn--primary"])}
          onClick={() => navigate("/selena")}
        >
          Play with Selena
        </button>
        <button class={styles["menu-btn"]} onClick={() => navigate("/analysis")}>
          Solo Analysis
        </button>
        <button class={styles["menu-btn"]} disabled>
          Learn to Play
        </button>
        <button class={styles["menu-btn"]} disabled>
          Play LAN
        </button>
        <span class={styles["coming-soon"]}>Coming soon!</span>
      </div>
    </div>
  );
};
