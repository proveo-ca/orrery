// SPEC: _spec/chess-coach/ui/components.puml
import { Chess } from "chess.js";
import { createSignal } from "solid-js";

import { markHintPressed } from "~/hooks/useGameRecorder";
import { useHint } from "~/hooks/useHint";
import { postExplainStream } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import { capabilities } from "~/store/capabilitiesStore";

/**
 * Set by `handleHint` once Stockfish returns a UCI hint. Consumed (and
 * cleared) by the game recorder when the human's next move is committed
 * so it can mark that move `isHintUsed`. Module-level so it is shared
 * across every `useGameControls` instance (Sidebar + MobileDrawer both
 * mount one).
 */
export const [pendingHintUci, setPendingHintUci] = createSignal<string | null>(null);
import {
  clearHoverOverride,
  dispatchCoachEvent,
  setAdvice,
  setAdviceArrow,
  setAdviceHoveredSquares,
} from "~/store/coachStore";
import {
  currentFen,
  currentIndex,
  fenHistory,
  goBack,
  goForward,
  isResigned,
  loadGame,
  resignGame,
  reviewAnalysisMode,
  savedReviewBranchIndex,
  savedReviewPgn,
  savedReviewStartingFen,
  setReviewAnalysisMode,
  setViewIndex,
} from "~/store/gameStore";
import {
  exitTravel,
  isTravelling,
  travelBack,
  travelFenHistory,
  travelForward,
  travelIndex,
} from "~/store/travelStore";

export const useGameControls = () => {
  const { requestHint, pendingHint } = useHint();

  const atStart = () => (isTravelling() ? travelIndex() === 0 : currentIndex() === 0);
  const atLatest = () =>
    isTravelling()
      ? travelIndex() === travelFenHistory().length - 1
      : currentIndex() === fenHistory().length - 1;

  const isReplaying = () =>
    !capabilities().historyBranching && currentIndex() < fenHistory().length - 1;

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
    if (reviewAnalysisMode()) {
      const pgn = savedReviewPgn();
      const fen = savedReviewStartingFen();
      const branchIndex = savedReviewBranchIndex();
      if (pgn || fen) {
        loadGame({ pgn, startingFen: fen });
        setViewIndex(branchIndex);
        setReviewAnalysisMode(false);
      }
      return;
    }
    if (isTravelling()) {
      exitTravel();
    }
    while (currentIndex() < fenHistory().length - 1) {
      goForward();
    }
    clearHoverOverride();
  };

  const handleResign = () => {
    resignGame();
  };

  const handleHint = async () => {
    try {
      // Mark hint pressed immediately so the recorder flags the next move.
      markHintPressed();

      dispatchCoachEvent({ type: "AI_THINKING" });
      const uciMove = await requestHint(currentFen(), 10);

      if (!uciMove) {
        setAdvice("I'm not sure what the best move is here.");
        dispatchCoachEvent({ type: "AI_MOVED" });
        return;
      }

      // Also stash the UCI for legacy "hint followed" tracking.
      setPendingHintUci(uciMove);

      const game = new Chess(currentFen());
      const gameInProgress = !game.isGameOver() && !isResigned();
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      const moveObj = game.move({ from, to, promotion });
      if (!moveObj) {
        setAdvice(`Try moving ${from}-${to}.`);
        dispatchCoachEvent({ type: "AI_MOVED" });
        return;
      }

      const san = moveObj.san;
      const fenAfter = game.fen();
      const prefix = `Try moving ${san}. `;

      // Highlight the hint move on the board while the game is in progress
      if (gameInProgress) {
        const squares = san.match(/[a-h][1-8]/g) || [];
        setAdviceHoveredSquares(squares);
        setAdviceArrow({ from: moveObj.from, to: moveObj.to });
      }

      if (capabilities().commentary) {
        setAdvice(`${prefix}Let me explain why...`);

        await accumulateStream(
          postExplainStream,
          { fenBefore: currentFen(), fenAfter, isBlunder: false, moveSan: san },
          setAdvice,
          { prefix },
        );
      } else {
        setAdvice(`Try moving ${san}.`);
      }

      dispatchCoachEvent({ type: "AI_MOVED" });
    } catch (err) {
      console.error(err);
      setAdvice("Unable to generate a hint right now.");
      dispatchCoachEvent({ type: "AI_ERROR" });
    }
  };

  return {
    atStart,
    atLatest,
    isReplaying,
    isResigned,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
    handleResign,
  };
};
