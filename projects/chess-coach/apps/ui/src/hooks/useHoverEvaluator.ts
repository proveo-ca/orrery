// SPEC: _spec/chess-coach/ui/components.puml
import { Chess, type Square } from "chess.js";
import { createEffect } from "solid-js";

import type { StockfishAnalysis } from "~/types/Stockfish";
import { capabilities } from "~/store/capabilitiesStore";
import {
  setHoverAdvice,
  setHoverBlunder,
  setHoverEmotion,
  setPendingTravel,
} from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import { blunderLabel, blunderThresholdCp } from "~/store/settingsStore";
import { logger } from "~/utils/logger";

export type HoverEval = { id: number; from: Square; to: Square; fen: string };

function scoreToHumanCp(s: { kind: "cp" | "mate"; value: number }, scoreSideIsHuman: boolean): number {
  if (s.kind === "cp") return scoreSideIsHuman ? s.value : -s.value;
  const dist = Math.abs(s.value);
  const mag = 100000 - dist * 100; // preserve mate distance (M1 >> M10)
  const signed = (s.value > 0 ? 1 : -1) * mag;
  return scoreSideIsHuman ? signed : -signed;
}

interface UseHoverEvaluatorProps {
  canApplyHoverOverride: () => boolean;
  hoveredSquare: () => Square | null;
  selectedSquare: () => Square | null;
  currentHoverEval: () => HoverEval | null;
  analysis: () => StockfishAnalysis;
  baseEvalScore: () => { kind: "cp" | "mate"; value: number } | null;
  humanBestMove: () => string | null;
  game: () => Chess;
}

export function useHoverEvaluator(props: UseHoverEvaluatorProps) {
  let lastProcessedEvalId = -1;

  createEffect(() => {
    // Screens without blunder detection (Solo Analysis) skip the coach
    // reaction and travel trigger entirely.
    if (!capabilities().blunderDetection) return;
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

    // Calculate Human's CP before the move (base is human-to-move)
    const humanBaseCp = scoreToHumanCp(baseScore, true);
    // After the hovered move, opponent is to move → invert perspective
    const humanHoverCp = scoreToHumanCp(msg.score, false);

    const delta = humanHoverCp - humanBaseCp;
    const isBlunder = delta <= blunderThresholdCp();

    logger.action(`Hover Eval Result [${evalTarget.from}-${evalTarget.to}]`, {
      baseScore,
      hoverScore: msg.score,
      delta,
      isBlunder,
    });

    if (!isBlunder) return;

    // Don't flag the move when it IS the engine's best move: if even the best
    // available move crosses the loss threshold, the position is already
    // lost/forced and there's nothing better to point the player toward.
    const bestUci = props.humanBestMove();
    if (bestUci && bestUci.slice(0, 4) === `${evalTarget.from}${evalTarget.to}`) return;

    logger.action("Stockfish Hover Blunder Detected", { msg, evalTarget });

    const piece = props.game().get(evalTarget.from);
    const pieceName = piece ? `${piece.color}${piece.type}` : "piece";

    // Generate SAN for the blunder
    const gCopy = new Chess(currentFen());
    const m = gCopy.move({ from: evalTarget.from, to: evalTarget.to, promotion: "q" });
    const san = m ? m.san : `${evalTarget.from}-${evalTarget.to}`;

    lastProcessedEvalId = evalTarget.id;
    setHoverAdvice(`Moving the ${pieceName} to ${evalTarget.to} is ${blunderLabel()}`);
    setHoverEmotion("shocked");
    setHoverBlunder(true, evalTarget.fen, san);
    setPendingTravel({ blunderFen: evalTarget.fen, blunderSan: san, fenBefore: currentFen() });
  });
}
