import { type Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";

import { postAdviceStream, postMove } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import {
  bestMovePhrases,
  dispatchCoachEvent,
  setAdvice,
  thinkingPhrases,
} from "~/store/coachStore";
import { capabilities } from "~/store/capabilitiesStore";
import { addMove, addMoveSan, game as gameFromStore, isThreefoldRepetition } from "~/store/gameStore";
import { type PlayerIdentity, difficulty, playerIdentity } from "~/store/settingsStore";
import { logger } from "~/utils/logger";

const QUEEN_CAPTURE_PHRASES: Record<PlayerIdentity, string[]> = {
  Human: [
    "I am the real Queen.",
    "That other Queen was too ugly anyway.",
    "The best piece, but not all is lost.",
    "Goodbye, Your Majesty. I won't miss you.",
  ],
  Cat: [
    "An honorable fight, your Highness.",
    "I guess I'm the new Lioness now.",
    "Miscalculated zoomies.",
    "She fought well, but I had all my nine lives.",
  ],
  Dog: [
    "The moon is sad today.",
    "Fierce battle, respect.",
    "I'll remember her in the moonlight.",
    "The bravest. Almost got me.",
  ],
  Rat: [
    "The legendary Kugaan Jaad is mine.",
    "Hopefully the Haida people will understand me.",
    "Sorry King Capy, no more Queen.",
    "Too strong for that undeserving army.",
  ],
};

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
  stockfishBestMove?: string;
};

function getGameOverState(isHumanTurn: boolean) {
  const g = gameFromStore();
  if (g.isCheckmate()) {
    return {
      result: isHumanTurn ? "win" : "loss",
      message: isHumanTurn ? "Checkmate! You win!" : "Checkmate! I win!",
    } as const;
  }
  if (isThreefoldRepetition()) {
    return { result: "draw", message: "Game over — draw by threefold repetition." } as const;
  }
  if (g.isGameOver()) {
    return { result: "draw", message: "Game over. It's a draw." } as const;
  }
  return null;
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

      const aiMove = addMoveSan(moveData.move);

      const overState = getGameOverState(false);
      if (overState) {
        dispatchCoachEvent({ type: "GAME_OVER", result: overState.result });
        setAdvice(overState.message);
        return;
      }

      // Easter egg: Selena captures the Queen
      if (aiMove.captured === "q") {
        const phrases = QUEEN_CAPTURE_PHRASES[playerIdentity()];
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
        dispatchCoachEvent({ type: "HUMAN_MOVE_BEST" }); // triggers "happy" emotion
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
      const result = addMove({ from: selected, to: square, promotion: "q" });

      abortAdvice();

      const humanMoveSan = result.san;
      const humanMoveLan = result.lan;
      const fenAfterHuman = result.after;

      stopStockfish();

      // Screens without an AI opponent (Solo Analysis) just apply the move;
      // no AI response, no coach advice.
      if (!capabilities().aiOpponent) {
        return { didMove: true, fenAfterHuman };
      }

      const overState = getGameOverState(true);
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
