import {createSignal} from 'solid-js';
import type {Component} from 'solid-js';
import {currentFen, currentIndex, fenHistory, goBack, goForward} from '../store';
import {clearHoverOverride} from '../store';
import {isTravelling, travelIndex, travelFenHistory, travelBack, travelForward, exitTravel} from '../store/travelState';
import {useHint} from '../hooks/useHint';
import {Credits} from './Credits';
import {TurnLabel} from './TurnLabel';
import {Button} from './common/Button';
import './Controls.css';

export const BoardActions: Component = () => {
  const [showCredits, setShowCredits] = createSignal(false);
  const {requestHint, pendingHint} = useHint('/stockfish-18-lite.js');

  const atStart = () => isTravelling() ? travelIndex() === 0 : currentIndex() === 0;
  const atLatest = () => isTravelling()
    ? travelIndex() === travelFenHistory().length - 1
    : currentIndex() === fenHistory().length - 1;

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  const handleBack = () => {
    if (isTravelling()) {
      if (travelIndex() === 0) {
        exitTravel();
        clearHoverOverride();
      } else {
        travelBack();
      }
    } else {
      goBack();
    }
  };

  const handleForward = () => {
    if (isTravelling()) {
      travelForward();
    } else {
      goForward();
    }
  };

  const handleBackToLive = () => {
    if (isTravelling()) {
      exitTravel();
    }
    // Fast-forward to the latest move to exit replay mode
    while (currentIndex() < fenHistory().length - 1) {
      goForward();
    }
    clearHoverOverride();
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
        <Button onClick={handleBack} disabled={atStart() && !isTravelling()}>
          &larr;
        </Button>
        <Button onClick={handleForward} disabled={atLatest()}>
          &rarr;
        </Button>
      </div>

      {(isTravelling() || isReplaying()) && (
        <div class="travel-row">
          {isTravelling() && <span class="travel-label">
            Move {travelIndex()}/{travelFenHistory().length - 1}
          </span>}
          {isReplaying() && <TurnLabel/>}
          <Button class="back-to-live" onClick={handleBackToLive}>Back to Live</Button>
        </div>
      )}

      <div class="nav-row">
        <Button onClick={handleHint} disabled={pendingHint() || isReplaying() || isTravelling()}>
          {pendingHint() ? 'Thinking...' : 'Hint'}
        </Button>
        <Button onClick={() => setShowCredits(true)} disabled={isReplaying() || isTravelling()}>Credits</Button>

        <Credits open={showCredits()} onClose={() => setShowCredits(false)}/>
      </div>
    </div>
  );
};
