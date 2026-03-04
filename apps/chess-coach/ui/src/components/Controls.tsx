import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Chess } from 'chess.js';
import { addMoveToHistory, currentFen, currentIndex, fenHistory, goBack, goForward, resetGame } from '../store/gameState';
import { setAdvice, setCoachEmotion } from '../store/coachState';
import { activePlayerColor, colorPref, difficulty, setColorPref, setDifficulty, type Difficulty } from '../store/settingsState';
import { useHint } from '../hooks/useHint';
import { Credits } from './Credits';
import { ColorSelector } from './common/ColorSelector';
import { postNewGame, postMove } from '../services/api';
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
          setCoachEmotion('thinking');
        }, 3000);
        try {
          const moveData = await postMove(API_URL, { move: "", fen: data.fen, difficulty: difficulty() });
          clearTimeout(thinkingTimeout);
          const aiGame = new Chess(data.fen);
          const aiMove = aiGame.move(moveData.move);
          addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });
          setAdvice(moveData.advice ?? "I've made my move!");
          setCoachEmotion('happy', 3000);
        } catch (e) {
          clearTimeout(thinkingTimeout);
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
      <select
        class="difficulty-select"
        value={difficulty()}
        onChange={(e) => setDifficulty(e.currentTarget.value as Difficulty)}
      >
        <option value="intermediate">Intermediate (1100)</option>
        <option value="advanced">Advanced (1600)</option>
        <option value="expert">Expert (2200)</option>
      </select>
      <button onClick={handleNewGame}>New Game</button>
    </div>
  );
};

export const BoardActions: Component = () => {
  const [showCredits, setShowCredits] = createSignal(false);
  const { requestHint, pendingHint } = useHint('/stockfish-18-lite.js');

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
      const move = await requestHint(currentFen(), 10);
      if (!move) {
        alert('Hint: No best move available.');
        return;
      }
      alert(`Hint: Try moving ${move}`);
    } catch {
      alert('Hint: Unable to generate a hint right now.');
    }
  };

  return (
    <div class="board-actions">
      <div class="nav-row">
        <button onClick={goBack} disabled={atStart()}>
          &larr; Back
        </button>
        <button onClick={goForward} disabled={atLatest()}>
          Forward &rarr;
        </button>
      </div>

      {isReplaying() && <div class="turn-label">{turnLabel()}</div>}

      {!isReplaying() && (
        <>
          <button onClick={handleHint} disabled={pendingHint()}>
            {pendingHint() ? 'Thinking...' : 'Get Hint'}
          </button>
          <button onClick={() => setShowCredits(true)}>Credits</button>
        </>
      )}

      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
    </div>
  );
};
