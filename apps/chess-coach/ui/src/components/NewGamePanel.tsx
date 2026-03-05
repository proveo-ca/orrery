import type {Component} from 'solid-js';
import {Chess} from 'chess.js';
import {
  addMoveToHistory,
  resetGame,
  setAdvice,
  dispatchCoachEvent,
  activePlayerColor,
  colorPref,
  difficulty,
  setColorPref,
  setDifficulty,
  type Difficulty
} from '../store';
import {ColorSelector} from './common/ColorSelector';
import {Button} from './common/Button';
import {Select} from './common/Select';
import {postNewGame, postMove} from '../services/api';
import './Controls.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export const NewGamePanel: Component = () => {
  const handleNewGame = async () => {
    try {
      const data = await postNewGame(API_URL);
      resetGame(data.fen);

      // If player is Black, trigger the AI to make the first move
      if (activePlayerColor() === 'b') {
        const thinkingTimeout = window.setTimeout(() => {
          dispatchCoachEvent({ type: 'AI_THINKING' });
        }, 3000);
        try {
          const moveData = await postMove(API_URL, {
            humanMoveSan: "",
            fenAfterHuman: data.fen,
            difficulty: difficulty()
          });
          clearTimeout(thinkingTimeout);
          const aiGame = new Chess(data.fen);
          const aiMove = aiGame.move(moveData.move);
          addMoveToHistory(moveData.fen, {from: aiMove.from, to: aiMove.to});
          setAdvice(moveData.advice ?? "I've made my move!");
          dispatchCoachEvent({ type: 'AI_MOVED' });
        } catch (e) {
          clearTimeout(thinkingTimeout);
          console.error("Failed to get AI's first move", e);
          dispatchCoachEvent({ type: 'AI_ERROR' });
        }
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    }
  };

  return (
    <div class="new-game-panel">
      <ColorSelector value={colorPref()} onChange={setColorPref}/>
      <Select
        class="difficulty-select"
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
