import { Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { currentFen, currentIndex, fenHistory } from '../store';
import { isTravelling } from '../store/travelState';
import './Controls.css';

export const TurnLabel: Component = () => {
  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  const memoizedLabel = createMemo(() => {
    const parts = currentFen().split(' ');
    const activeColor = parts[1] || 'w';
    const fullmove = Number(parts[5] || '?');
    return `Move ${fullmove}${activeColor === 'b' ? '...' : '.'}`;
  });

  return (
    <Show when={!isTravelling() && isReplaying()}>
      <div class="turn-label">{memoizedLabel()}</div>
    </Show>
  );
};
