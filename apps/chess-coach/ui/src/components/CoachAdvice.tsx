import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { advice, setAdviceHoveredSquares, hoverBlunder } from '../store';
import { isTravelling } from '../store/travelState';
import './CoachAdvice.css';

// Regex to match standard algebraic notation (SAN) and raw squares
// Matches: e4, Nf3, Bxc6+, O-O, O-O-O, e8=Q
const CHESS_NOTATION_REGEX = /(\b[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?\b|\bO-O(?:-O)?\b)/g;

export const CoachAdvice: Component = () => {
  const handleMouseEnter = (text: string) => {
    // Extract just the square coordinates (e.g., "f3" from "Nf3")
    const squares = text.match(/[a-h][1-8]/g) || [];
    setAdviceHoveredSquares(squares);
  };

  const handleMouseLeave = () => {
    setAdviceHoveredSquares([]);
  };

  const parsedAdvice = () => advice().split(CHESS_NOTATION_REGEX);

  return (
    <div class="coach-panel">
      <h3>Coach Selena</h3>
      <p>
        <For each={parsedAdvice()}>
          {(part) => {
            if (part.match(CHESS_NOTATION_REGEX)) {
              return (
                <span 
                  class="move-highlight"
                  onMouseEnter={() => handleMouseEnter(part)}
                  onMouseLeave={handleMouseLeave}
                >
                  {part}
                </span>
              );
            }
            return <span>{part}</span>;
          }}
        </For>
      </p>
      <Show when={hoverBlunder() && !isTravelling()}>
        <span class="why-hint">Press <kbd>Space</kbd> — To learn why</span>
      </Show>
    </div>
  );
};
