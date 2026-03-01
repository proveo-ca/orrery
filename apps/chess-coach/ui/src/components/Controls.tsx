import type { Component } from 'solid-js';
import { goBack, goForward, resetGame, colorPref, setColorPref, activePlayerColor, setCoachEmotion, setAdvice, addMoveToHistory, currentFen, currentIndex, fenHistory } from '../store/gameStore';
import { ColorSelector } from './common/ColorSelector';
import './Controls.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export const NewGamePanel: Component = () => {
  const handleNewGame = async () => {
    try {
      const res = await fetch(`${API_URL}/new`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        resetGame(data.fen);
        
        // If player is Black, trigger the AI to make the first move
        if (activePlayerColor() === 'b') {
          setCoachEmotion('thinking');
          const moveRes = await fetch(`${API_URL}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ move: "", fen: data.fen })
          });
          
          if (moveRes.ok) {
            const moveData = await moveRes.json();
            addMoveToHistory(moveData.fen);
            setAdvice(moveData.advice);
            setCoachEmotion('happy', 3000);
          }
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
      const res = await fetch(`${API_URL}/hint`);
      if (res.ok) {
        const data = await res.json();
        alert(`Hints:\n${data.hints.join('\n')}`);
      }
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
