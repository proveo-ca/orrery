import { Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";

import { postAdviceStream, postMove } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import {
  bestMovePhrases,
  dispatchCoachEvent,
  setAdvice,
  thinkingPhrases,
} from "~/store/coachStore";
import { addMoveToHistory } from "~/store/gameStore";
import { difficulty } from "~/store/settingsStore";
import { logger } from "~/utils/logger";

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
  stockfishBestMove?: string;
};

function getGameOverState(game: Chess, isHumanTurn: boolean) {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    return {
      result: isHumanTurn ? "win" : "loss",
      message: isHumanTurn ? "Checkmate! You win!" : "Checkmate! I win!",
    } as const;
  }
  if (game.isThreefoldRepetition()) {
    return { result: "draw", message: "Game over — draw by threefold repetition." } as const;
  }
  return { result: "draw", message: "Game over. It's a draw." } as const;
}

export function useMoveExecutor(stopStockfish: () => void) {
  const [adviceAbortController, setAdviceAbortController] = createSignal<AbortController | null>(
    null,
  );

  const abortAdvice = () => {
    const controller = adviceAbortController();
    if (controller) controller.abort();
    setAdviceAbortController(null);
  };

  const _streamAdvice = async (humanMoveSan: string, moveData: { fen: string; move: string }) => {
    const controller = new AbortController();
    setAdviceAbortController(controller);

    try {
      const fullAdvice = await accumulateStream(
        postAdviceStream,
        { humanMove: humanMoveSan, aiMove: moveData.move, fen: moveData.fen },
        setAdvice,
        { signal: controller.signal },
      );

      const adviceLower = fullAdvice.toLowerCase();
      const isBlunder = adviceLower.includes("blunder") || adviceLower.includes("mistake");
      dispatchCoachEvent({ type: "ADVICE_RECEIVED", isBlunder });
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.action("Advice request aborted due to new move.");
      } else {
        logger.error("Advice stream failed", err);
        setAdvice("Error getting advice.");
        dispatchCoachEvent({ type: "AI_ERROR" });
      }
    }
  };

  const _processAITurn = async (humanMoveSan: string, fenAfterHuman: string) => {
    try {
      const moveData = await postMove({ humanMoveSan, fenAfterHuman, difficulty: difficulty() });

      const aiGame = new Chess(fenAfterHuman);
      const aiMove = aiGame.move(moveData.move);
      addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });

      const finalGame = new Chess(moveData.fen);
      const overState = getGameOverState(finalGame, false);
      if (overState) {
        dispatchCoachEvent({ type: "GAME_OVER", result: overState.result });
        setAdvice(overState.message);
        return;
      }

      dispatchCoachEvent({ type: "AI_MOVED" });

      // Kick off advice stream (non-blocking)
      void _streamAdvice(humanMoveSan, moveData);
    } catch (err) {
      logger.error("Error communicating with the coach", err);
      setAdvice("Error communicating with the coach.");
      dispatchCoachEvent({ type: "AI_ERROR" });
    }
  };

  const executeMove = async (
    params: ExecuteMoveParams,
  ): Promise<{ didMove: boolean; fenAfterHuman?: string }> => {
    const { game, selected, square } = params;

    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === square);
    if (!move) return { didMove: false };

    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move({ from: selected, to: square, promotion: "q" });

      if (!result) return { didMove: false };

      abortAdvice();

      const humanMoveSan = result.san;
      const humanMoveLan = result.lan; // e.g. "e2e4"
      const fenAfterHuman = gameCopy.fen();

      addMoveToHistory(fenAfterHuman, { from: result.from, to: result.to });
      stopStockfish();

      const overState = getGameOverState(gameCopy, true);
      if (overState) {
        dispatchCoachEvent({ type: "GAME_OVER", result: overState.result });
        setAdvice(overState.message);
        return { didMove: true, fenAfterHuman };
      }

      if (params.stockfishBestMove && humanMoveLan === params.stockfishBestMove) {
        const phrases = bestMovePhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
        dispatchCoachEvent({ type: "HUMAN_MOVE_BEST" });
      } else {
        dispatchCoachEvent({ type: "HUMAN_MOVE_NORMAL" });
        const phrases = thinkingPhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      }

      // Trigger AI asynchronously
      void _processAITurn(humanMoveSan, fenAfterHuman);

      return { didMove: true, fenAfterHuman };
    } catch (e) {
      logger.error("Move execution error", e);
      return { didMove: false };
    }
  };

  return { executeMove, abortAdvice };
}
