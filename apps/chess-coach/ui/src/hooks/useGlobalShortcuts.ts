// apps/chess-coach/ui/src/hooks/useGlobalShortcuts.ts
import { onCleanup, onMount } from 'solid-js';
import { hoverBlunder, hoverBlunderFen, currentIndex, fenHistory, goForward, clearHoverOverride } from '../store';
import { isTravelling, exitTravel } from '../store/travelState';
import { useTravelMode } from './useTravelMode';

export function useGlobalShortcuts(resetInactivityTimers: () => void) {
  const { activateTravel, loading } = useTravelMode();

  const handleKeyDown = (e: KeyboardEvent) => {
    resetInactivityTimers();
    const isReplaying = currentIndex() < fenHistory().length - 1;

    if (e.code === 'Space' && hoverBlunder() && !isTravelling() && !loading()) {
      e.preventDefault();
      const fen = hoverBlunderFen();
      if (fen) activateTravel(fen);
    } else if (e.code === 'Escape') {
      if (isTravelling() || isReplaying) {
        e.preventDefault();
        if (isTravelling()) exitTravel();
        while (currentIndex() < fenHistory().length - 1) {
          goForward();
        }
        clearHoverOverride();
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
