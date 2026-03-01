import type { Component } from 'solid-js';
import { goBack, goForward, resetGame, isCoachMode, toggleMode } from '../store/gameStore';
import { Toggle } from './common/Toggle';
import './Controls.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export const Controls: Component = () => {
  const handleNewGame = async () => {
    try {
      const res = await fetch(`${API_URL}/new`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        resetGame(data.fen);
      }
    } catch (e) {
      console.error("Failed to start new game", e);
      resetGame(); // Fallback to local reset
    }
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
    <div class="controls">
      <Toggle 
        checked={isCoachMode()} 
        onChange={toggleMode} 
        label={isCoachMode() ? '🐈‍⬛ Coach Mode' : '👤 Solo Mode'} 
      />
      
      <div class="action-buttons">
        <button onClick={handleNewGame}>New Game</button>
        <button onClick={goBack}>&larr; Back</button>
        <button onClick={goForward}>Forward &rarr;</button>
        <button onClick={handleHint}>Get Hint</button>
      </div>
    </div>
  );
};
