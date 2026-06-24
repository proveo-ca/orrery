import type { Component } from "solid-js";

import styles from "~/components/features/NewGamePanel.module.css";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { Button } from "~/components/primitives/Button";
import { ColorSelector } from "~/components/primitives/ColorSelector";
import { Select } from "~/components/primitives/Select";
import { Toggle } from "~/components/primitives/Toggle";
import { setLastAIMoveInfo } from "~/hooks/useMoveExecutor";
import { postMove, postNewGame } from "~/services/api";
import { dispatchCoachEvent, setAdvice, setShowNewGame } from "~/store/coachStore";
import { addMoveSan, resetGame } from "~/store/gameStore";
import {
  activePlayerColor,
  colorPref,
  difficulty,
  imLost,
  playerIdentity,
  setColorPref,
  setDifficulty,
  setImLost,
  setPlayerIdentity,
} from "~/store/settingsStore";
import type { Difficulty, PlayerIdentity } from "~/types/settings";

const IDENTITY_OPTIONS: PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

export const NewGamePanel: Component = () => {
  const handleNewGame = async () => {
    try {
      const data = await postNewGame();
      resetGame(data.fen);

      // If player is Black, trigger the AI to make the first move
      if (activePlayerColor() === "b") {
        const thinkingTimeout = window.setTimeout(() => {
          dispatchCoachEvent({ type: "AI_THINKING" });
        }, 3000);
        try {
          const moveData = await postMove({
            humanMoveSan: "",
            fenAfterHuman: data.fen,
            difficulty: difficulty(),
          });

          setLastAIMoveInfo({
            san: moveData.move,
            humanMoveSan: "",
            fen: moveData.fen,
            move: moveData.move,
            gameOver: null,
          });
          addMoveSan(moveData.move);
          setAdvice(moveData.advice ?? "I've made my move!");
          dispatchCoachEvent({ type: "AI_MOVED" });
        } catch (e) {
          console.error("Failed to get AI's first move", e);
          dispatchCoachEvent({ type: "AI_ERROR" });
        } finally {
          clearTimeout(thinkingTimeout);
        }
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    } finally {
      setShowNewGame(false);
    }
  };

  return (
    <div class={styles["new-game-panel"]}>
      <PlayerNameField />
      <ColorSelector value={colorPref()} onChange={setColorPref} />
      <Select
        class={styles["difficulty-select"]}
        value={difficulty()}
        onChange={(e) => setDifficulty(e.currentTarget.value as Difficulty)}
      >
        <option value="intermediate">Intermediate (1100)</option>
        <option value="advanced">Advanced (1600)</option>
        <option value="expert">Expert (2200)</option>
      </Select>
      <Select
        value={playerIdentity()}
        onChange={(e) => setPlayerIdentity(e.currentTarget.value as PlayerIdentity)}
        disabled={imLost()}
      >
        {IDENTITY_OPTIONS.map((id) => (
          <option value={id}>{id}</option>
        ))}
      </Select>
      <Toggle label="i'm lost" checked={imLost()} onChange={(v) => setImLost(v)} />
      <Button class={styles["start-btn"]} onClick={handleNewGame}>
        Start
      </Button>
    </div>
  );
};
