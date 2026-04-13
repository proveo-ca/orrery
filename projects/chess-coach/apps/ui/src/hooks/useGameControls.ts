import { Chess } from "chess.js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { useHint } from "~/hooks/useHint";
import { postExplainStream } from "~/services/api";
import { clearHoverOverride, dispatchCoachEvent, setAdvice } from "~/store/coachStore";
import { currentFen, currentIndex, fenHistory, goBack, goForward } from "~/store/gameStore";
import {
  exitTravel,
  isTravelling,
  travelBack,
  travelFenHistory,
  travelForward,
  travelIndex,
} from "~/store/travelStore";

export const useGameControls = () => {
  const { requestHint, pendingHint } = useHint(DEFAULT_STOCKFISH_WORKER_URL);

  const atStart = () => (isTravelling() ? travelIndex() === 0 : currentIndex() === 0);
  const atLatest = () =>
    isTravelling()
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
    while (currentIndex() < fenHistory().length - 1) {
      goForward();
    }
    clearHoverOverride();
  };

  const handleHint = async () => {
    try {
      dispatchCoachEvent({ type: "AI_THINKING" });
      const uciMove = await requestHint(currentFen(), 10);

      if (!uciMove) {
        setAdvice("I'm not sure what the best move is here.");
        dispatchCoachEvent({ type: "AI_MOVED" });
        return;
      }

      const game = new Chess(currentFen());
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

      setAdvice(`${prefix}Let me explain why...`);

      let fullExplanation = "";
      let receivedFirstChunk = false;

      await postExplainStream(
        { fenBefore: currentFen(), fenAfter, isBlunder: false, moveSan: san },
        (chunk) => {
          if (!receivedFirstChunk) {
            fullExplanation = "";
            receivedFirstChunk = true;
          }
          fullExplanation += chunk;
          setAdvice(prefix + fullExplanation);
        },
      );

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
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
  };
};
