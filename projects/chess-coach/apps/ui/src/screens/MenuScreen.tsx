// SPEC: _spec/chess-coach/ui/components.puml
import type { Difficulty, PlayerIdentity } from "~/types/settings";
import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { Credits } from "~/components/atoms/Credits";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { Label } from "~/components/primitives/Label";
import { MenuButton } from "~/components/primitives/MenuButton";
import { Select } from "~/components/primitives/Select";
import { SplashScreen } from "~/components/primitives/SplashScreen";
import styles from "~/screens/MenuScreen.module.css";
import { setShowCredits, showCredits } from "~/store/coachStore";
import { gameHistory } from "~/store/gameHistoryStore";
import { difficulty, playerIdentity, setDifficulty, setPlayerIdentity } from "~/store/settingsStore";

const IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

export const MenuScreen: Component = () => {
  const navigate = useNavigate();

  return (
    <SplashScreen title="Wanna play Chess?" avatar={<CoachAvatar />}>
      <div class={styles["identity-row"]}>
        <label class={styles["identity-label"]} for="player-name">
          Name:
        </label>
        <PlayerNameField id="player-name" />
      </div>
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
        <div class={styles["selena-row"]}>
          <MenuButton primary onClick={() => navigate("/selena")}>
            Play with Selena
          </MenuButton>
          <Select
            class={styles["difficulty-select"]}
            value={difficulty()}
            onChange={(e) => setDifficulty(e.currentTarget.value as Difficulty)}
          >
            <option value="intermediate">Intermediate (1100)</option>
            <option value="advanced">Advanced (1600)</option>
            <option value="expert">Expert (2200)</option>
          </Select>
        </div>
        <MenuButton onClick={() => navigate("/analysis")}>Solo Analysis</MenuButton>
        <MenuButton onClick={() => navigate("/review")} disabled={gameHistory().length === 0}>
          Review
        </MenuButton>
        <MenuButton onClick={() => navigate("/lan")}>Play LAN</MenuButton>
        <MenuButton disabled>Learn to Play</MenuButton>
        <Label variant="caption" class={styles["coming-soon"]}>
          Coming soon!
        </Label>
      </div>
      <MenuButton class={styles["credits-btn"]} onClick={() => setShowCredits(true)}>
        Credits
      </MenuButton>
      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
    </SplashScreen>
  );
};
