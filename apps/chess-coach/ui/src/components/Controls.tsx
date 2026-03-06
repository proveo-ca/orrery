import {createSignal} from 'solid-js';
import type {Component} from 'solid-js';
import {currentFen, currentIndex, fenHistory, goBack, goForward, setAdvice, dispatchCoachEvent, clearHoverOverride} from '../store';
import {isTravelling, travelIndex, travelFenHistory, travelBack, travelForward, exitTravel} from '../store/travelState';
import {useHint} from '../hooks/useHint';
import {Credits} from './Credits';
import {TurnLabel} from './TurnLabel';
import {Button} from './common/Button';
import {postExplainStream} from '../services/api';
import {Chess} from 'chess.js';
import './Controls.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
      dispatchCoachEvent({ type: 'AI_THINKING' });
      const uciMove = await requestHint(currentFen(), 10);
      
      if (!uciMove) {
        setAdvice("I'm not sure what the best move is here.");
        dispatchCoachEvent({ type: 'AI_MOVED' });
        return;
      }

      // Parse the UCI move (e.g., "e2e4") into SAN (e.g., "e4")
      const game = new Chess(currentFen());
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
      
      const moveObj = game.move({ from, to, promotion });
      if (!moveObj) {
        setAdvice(`Try moving ${from}-${to}.`);
        dispatchCoachEvent({ type: 'AI_MOVED' });
        return;
      }

      const san = moveObj.san;
      const fenAfter = game.fen();
      const prefix = `Try moving ${san}. `;
      
      setAdvice(`${prefix}Let me explain why...`);

      let fullExplanation = '';
      let receivedFirstChunk = false;

      await postExplainStream(
        API_URL,
        { fenBefore: currentFen(), fenAfter, isBlunder: false },
        (chunk) => {
          if (!receivedFirstChunk) {
            fullExplanation = '';
            receivedFirstChunk = true;
          }
          fullExplanation += chunk;
          setAdvice(prefix + fullExplanation);
        }
      );
      
      dispatchCoachEvent({ type: 'AI_MOVED' });
    } catch (err) {
      console.error(err);
      setAdvice('Unable to generate a hint right now.');
      dispatchCoachEvent({ type: 'AI_ERROR' });
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
