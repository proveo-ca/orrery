import { Chess } from "chess.js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import { ColorSelector } from "~/components/common/ColorSelector";
import { Select } from "~/components/common/Select";
import styles from "~/components/Controls.module.css";
import { postMove, postNewGame } from "~/services/api";
import { dispatchCoachEvent, setAdvice } from "~/store/coachStore";
import { addMoveToHistory, resetGame } from "~/store/gameStore";
import {
  type Difficulty,
  activePlayerColor,
  colorPref,
  difficulty,
  setColorPref,
  setDifficulty,
} from "~/store/settingsStore";

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
          clearTimeout(thinkingTimeout);
          const aiGame = new Chess(data.fen);
          const aiMove = aiGame.move(moveData.move);
          addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });
          setAdvice(moveData.advice ?? "I've made my move!");
          dispatchCoachEvent({ type: "AI_MOVED" });
        } catch (e) {
          clearTimeout(thinkingTimeout);
          console.error("Failed to get AI's first move", e);
          dispatchCoachEvent({ type: "AI_ERROR" });
        }
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    }
  };

  return (
    <div class={styles["new-game-panel"]}>
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
      <Button onClick={handleNewGame}>New Game</Button>
    </div>
  );
};
