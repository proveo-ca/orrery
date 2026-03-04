import type { Component } from 'solid-js';
import { goBack, goForward, resetGame, colorPref, setColorPref, activePlayerColor, setCoachEmotion, setAdvice, addMoveToHistory, currentFen, currentIndex, fenHistory, difficulty, setDifficulty } from '../store/gameStore';
import { ColorSelector } from './common/ColorSelector';
import { postNewGame, postMove, fetchHint } from '../services/api';
import './Controls.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export const NewGamePanel: Component = () => {
  const handleNewGame = async () => {
    try {
      const data = await postNewGame(API_URL);
      resetGame(data.fen);
      
      // If player is Black, trigger the AI to make the first move
      if (activePlayerColor() === 'b') {
        setCoachEmotion('thinking');
        try {
          const moveData = await postMove(API_URL, { move: "", fen: data.fen, difficulty: difficulty() });
          addMoveToHistory(moveData.fen);
          // Note: MoveResponse doesn't officially have 'advice', but keeping fallback just in case
          setAdvice((moveData as any).advice || "I've made my move!");
          setCoachEmotion('happy', 3000);
        } catch (e) {
          console.error("Failed to get AI's first move", e);
          setCoachEmotion('shocked', 3000);
        }
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    }
  };

  return (
    <div class="new-game-panel">
      <ColorSelector value={colorPref()} onChange={setColorPref} />
      <select class="difficulty-select" value={difficulty()} onChange={(e) => setDifficulty(e.target.value as any)}>
        <option value="intermediate">Intermediate (1100)</option>
        <option value="advanced">Advanced (1600)</option>
        <option value="expert">Expert (2200)</option>
      </select>
      <button onClick={handleNewGame}>New Game</button>
    </div>
  );
};

export const BoardActions: Component = () => {
  const atStart = () => currentIndex() === 0;
  const atLatest = () => currentIndex() === fenHistory().length - 1;

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  const turnLabel = () => {
    const parts = currentFen().split(' ');
    const activeColor = parts[1] || 'w';
    const fullmove = Number(parts[5] || '?');
    return `Move ${fullmove}${activeColor === 'b' ? '...' : '.'}`;
  };

  const handleHint = async () => {
    try {
      const data = await fetchHint(API_URL);
      alert(`Hints:\n${data.hints.join('\n')}`);
    } catch (e) {
      console.error("Failed to get hint", e);
    }
  };

  return (
    <div class="board-actions">
      <div class="nav-row">
        <button onClick={goBack} disabled={atStart()}>&larr; Back</button>
        <button onClick={goForward} disabled={atLatest()}>Forward &rarr;</button>
      </div>

      {isReplaying() && (
        <div class="turn-label">{turnLabel()}</div>
      )}

      {!isReplaying() && <button onClick={handleHint}>Get Hint</button>}
    </div>
  );
};
