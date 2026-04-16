import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

import { CoachAvatar } from "~/components/CoachAvatar";
import { Label } from "~/components/common/Label";
import { MenuButton } from "~/components/common/MenuButton";
import { Select } from "~/components/common/Select";
import styles from "~/components/common/SplashScreen.module.css";
import { gameHistory } from "~/store/gameHistoryStore";
import { playerIdentity, setPlayerIdentity, type PlayerIdentity } from "~/store/settingsStore";

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
        <MenuButton primary onClick={() => navigate("/selena")}>
          Play with Selena
        </MenuButton>
        <MenuButton onClick={() => navigate("/analysis")}>Solo Analysis</MenuButton>
        <MenuButton onClick={() => navigate("/review")} disabled={gameHistory().length === 0}>
          Review
        </MenuButton>
        <MenuButton disabled>Learn to Play</MenuButton>
        <MenuButton disabled>Play LAN</MenuButton>
        <Label variant="caption" class={styles["coming-soon"]}>
          Coming soon!
        </Label>
      </div>
    </div>
  );
};
