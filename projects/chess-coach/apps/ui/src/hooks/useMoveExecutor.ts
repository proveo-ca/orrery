import { type Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";

import { postMove } from "~/services/api";
import { resolveMode } from "~/services/runtimeMode";
import { capabilities } from "~/store/capabilitiesStore";
import { setAdvice, setCoachEmotion } from "~/store/coachStore";
import {
  addMove,
  addMoveSan,
  game as gameFromStore,
  isThreefoldRepetition,
} from "~/store/gameStore";
import { difficulty } from "~/store/settingsStore";
import type { PromotionPiece } from "~/types/chess";
import type { StockfishAnalysis } from "~/types/Stockfish";
import { logger } from "~/utils/logger";

const HAS_REMOTE_COACH = resolveMode().kind === "desktop";

export const [lastHumanMoveInfo, setLastHumanMoveInfo] = createSignal<{
  san: string;
  lan: string;
  wasBestMove: boolean;
  gameOver: { result: "win" | "loss" | "draw"; message: string } | null;
} | null>(null);

export const [lastAIMoveInfo, setLastAIMoveInfo] = createSignal<{
  san: string;
  captured?: string;
  humanMoveSan: string;
  fen: string;
  move: string;
  gameOver: { result: "win" | "loss" | "draw"; message: string } | null;
} | null>(null);

/** Emitted when the AI turn fails so coach behavior can react. */
export const [lastAIError, setLastAIError] = createSignal<string | null>(null);

/**
 * Chess.com / USCF insufficient material rules:
 * - Both sides each have at most one minor piece (K, K+B, or K+N) → draw
 * - K+2N vs lone K → draw (no forced mate; Chess.com follows USCF here)
 * - K+2N vs K+minor → NOT a draw (checkmate is possible with the extra piece)
 */
function isInsufficientMaterial(g: ReturnType<typeof gameFromStore>): boolean {
  let wQ = 0,
    wR = 0,
    wB = 0,
    wN = 0,
    wP = 0;
  let bQ = 0,
    bR = 0,
    bB = 0,
    bN = 0,
    bP = 0;

  for (const piece of g.board().flat()) {
    if (!piece) continue;
    if (piece.color === "w") {
      if (piece.type === "q") wQ++;
      else if (piece.type === "r") wR++;
      else if (piece.type === "b") wB++;
      else if (piece.type === "n") wN++;
      else if (piece.type === "p") wP++;
    } else {
      if (piece.type === "q") bQ++;
      else if (piece.type === "r") bR++;
      else if (piece.type === "b") bB++;
      else if (piece.type === "n") bN++;
      else if (piece.type === "p") bP++;
    }
  }

  if (wQ || bQ || wR || bR || wP || bP) return false;

  const wMinor = wB + wN;
  const bMinor = bB + bN;

  if (wMinor <= 1 && bMinor <= 1) return true;

  // K+2N vs lone K only
  if (wN === 2 && wB === 0 && bMinor === 0) return true;
  if (bN === 2 && bB === 0 && wMinor === 0) return true;

  return false;
}

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
  if (isInsufficientMaterial(g)) {
    return { result: "draw", message: "Game over — draw by insufficient material." } as const;
  }
  if (g.isGameOver()) {
    return { result: "draw", message: "Game over. It's a draw." } as const;
  }
  return null;
}

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
  stockfishBestMove?: string;
  analysis?: () => StockfishAnalysis;
  /**
   * Called when the pending move is a pawn promotion so the caller can
   * prompt the user to pick a piece. Resolving with `null` cancels the
   * move (executeMove returns `{ didMove: false, cancelled: true }`).
   */
  onPromotionRequired?: () => Promise<PromotionPiece | null>;
};

export function useMoveExecutor(stopStockfish: () => void) {
  const _processAITurn = async (
    humanMoveSan: string,
    fenAfterHuman: string,
    analysis?: () => StockfishAnalysis,
  ): Promise<void> => {
    try {
      const moveData = await postMove({ humanMoveSan, fenAfterHuman, difficulty: difficulty() });

      const aiMove = addMoveSan(moveData.move);
      const gameOver = getGameOverState(false) ?? null;

      setLastAIMoveInfo({
        san: aiMove.san,
        captured: aiMove.captured as string | undefined,
        humanMoveSan,
        fen: moveData.fen,
        move: moveData.move,
        gameOver,
      });

      // Detect if the AI has put the human under a mating sequence
      const lastInfo = analysis?.().lastInfo;
      if (lastInfo?.score?.kind === "mate" && lastInfo.score.value < 0) {
        logger.action("Human is under a mating sequence");
        setCoachEmotion("shocked");
        setAdvice("You're under a mating sequence!");
      }
    } catch (err) {
      logger.error("AI move failed", err);
      setLastAIError(
        HAS_REMOTE_COACH ? "Error communicating with the coach." : "The coach stumbled. Try again.",
      );
    }
  };

  const executeMove = async (
    params: ExecuteMoveParams,
  ): Promise<{ didMove: boolean; fenAfterHuman?: string; cancelled?: boolean }> => {
    const { game, selected, square, onPromotionRequired } = params;

    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === square);
    if (!move) return { didMove: false };

    // chess.js emits one entry per promotion target (q/r/b/n) for the same
    // from→to pair, so `move.promotion` on any match is enough to flag the
    // move as a promotion. Ask the caller to pick a piece; default to queen
    // only when no resolver is wired (keeps tests / non-UI callers working).
    let promotion: PromotionPiece = "q";
    if (move.promotion) {
      if (onPromotionRequired) {
        const choice = await onPromotionRequired();
        if (!choice) return { didMove: false, cancelled: true };
        promotion = choice;
      }
    }

    try {
      const result = addMove({ from: selected, to: square, promotion });

      const humanMoveSan = result.san;
      const humanMoveLan = result.lan;
      const fenAfterHuman = result.after;
      const wasBestMove = !!(params.stockfishBestMove && humanMoveLan === params.stockfishBestMove);

      stopStockfish();

      const gameOver = capabilities().aiOpponent ? (getGameOverState(true) ?? null) : null;
      setLastHumanMoveInfo({ san: humanMoveSan, lan: humanMoveLan, wasBestMove, gameOver });

      // Detect if human has started a mating sequence (AI is now getting mated)
      const lastInfo = params.analysis?.().lastInfo;
      if (lastInfo?.score?.kind === "mate" && lastInfo.score.value < 0) {
        logger.action("Human started mating sequence");
        setCoachEmotion("happy");
        setAdvice("You have begun a mating sequence!");
      }

      if (!capabilities().aiOpponent || gameOver) {
        return { didMove: true, fenAfterHuman };
      }

      await _processAITurn(humanMoveSan, fenAfterHuman, params.analysis);

      return { didMove: true, fenAfterHuman };
    } catch (e) {
      logger.error("Move execution error", e);
      return { didMove: false };
    }
  };

  return { executeMove };
}
