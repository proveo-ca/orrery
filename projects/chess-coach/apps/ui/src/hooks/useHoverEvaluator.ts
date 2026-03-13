import { Chess, type Square } from "chess.js";
import { createEffect } from "solid-js";

import type { StockfishAnalysis } from "~/hooks/useStockfishWorker";
import { setHoverAdvice, setHoverBlunder, setHoverEmotion } from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import { logger } from "~/utils/logger";

export type HoverEval = { id: number; from: Square; to: Square; fen: string };

const BLUNDER_THRESHOLD_CP = -200;

interface UseHoverEvaluatorProps {
  canApplyHoverOverride: () => boolean;
  hoveredSquare: () => Square | null;
  selectedSquare: () => Square | null;
  currentHoverEval: () => HoverEval | null;
  analysis: () => StockfishAnalysis;
  baseEvalScore: () => { kind: "cp" | "mate"; value: number } | null;
  game: () => Chess;
}

export function useHoverEvaluator(props: UseHoverEvaluatorProps) {
  let lastProcessedEvalId = -1;

  createEffect(() => {
    if (!props.canApplyHoverOverride()) return;

    const hovered = props.hoveredSquare();
    const selected = props.selectedSquare();
    if (!hovered || !selected) return;

    const evalTarget = props.currentHoverEval();
    if (!evalTarget) return;
    if (evalTarget.to !== hovered || evalTarget.from !== selected) return;

    const msg = props.analysis().lastInfo;
    if (!msg || !msg.score) return;

    const baseScore = props.baseEvalScore();
    if (!baseScore) return; // We need the before-score to calculate a delta

    // Skip if we already processed this eval's result
    if (evalTarget.id <= lastProcessedEvalId) return;

    // Anti-race-condition: Ensure the PV move is legal in the hover position.
    if (!msg.pv || msg.pv.length === 0) {
      if (msg.score.kind !== "mate" || msg.score.value !== 0) {
        return; // Ignore empty PVs unless it's a checkmate (mate 0)
      }
    } else {
      try {
        const testGame = new Chess(evalTarget.fen);
        const uci = msg.pv[0];
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = testGame.move({ from, to, promotion });
        if (!move) return; // Stale info message from previous position
      } catch {
        return; // Invalid move format
      }
    }

    // Calculate Human's CP before the move
    const humanBaseCp =
      baseScore.kind === "mate" ? (baseScore.value > 0 ? 10000 : -10000) : baseScore.value;

    // Calculate Human's CP after the move
    const humanHoverCp =
      msg.score.kind === "mate" ? (msg.score.value > 0 ? -10000 : 10000) : -msg.score.value;

    const delta = humanHoverCp - humanBaseCp;
    const isBlunder = delta <= BLUNDER_THRESHOLD_CP;

    logger.action(`Hover Eval Result [${evalTarget.from}-${evalTarget.to}]`, {
      baseScore,
      hoverScore: msg.score,
      delta,
      isBlunder,
    });

    if (!isBlunder) return;

    logger.action("Stockfish Hover Blunder Detected", { msg, evalTarget });

    const piece = props.game().get(evalTarget.from);
    const pieceName = piece ? `${piece.color}${piece.type}` : "piece";

    // Generate SAN for the blunder
    const gCopy = new Chess(currentFen());
    const m = gCopy.move({ from: evalTarget.from, to: evalTarget.to, promotion: "q" });
    const san = m ? m.san : `${evalTarget.from}-${evalTarget.to}`;

    lastProcessedEvalId = evalTarget.id;
    setHoverAdvice(`Moving the ${pieceName} to ${evalTarget.to} is a blunder`);
    setHoverEmotion("shocked");
    setHoverBlunder(true, evalTarget.fen, san);
  });
}
