// SPEC: _spec/chess-coach/ui/components.puml
import type { MoveSquares } from "~/types/game";
import { Chess } from "chess.js";
import { createSignal } from "solid-js";

import { enginePool } from "~/engine/EnginePool";
import { postExplainStream } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import { clearPendingTravel, setHoverAdvice, setHoverEmotion } from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import { startTravel } from "~/store/travelStore";

/**
 * Requests the best line (PV) from the shared engine pool, then plays it
 * out move-by-move to build a fake timeline.
 */
export function useTravelMode() {
  const [loading, setLoading] = createSignal(false);

  const activateTravel = async (blunderFen: string, blunderSan: string, fenBefore?: string) => {
    setLoading(true);
    clearPendingTravel();
    setHoverAdvice("Travelling to the future...");
    setHoverEmotion("thinking");

    // Lock the board immediately so mouse movements don't clear the hover state
    startTravel([blunderFen], [null]);

    // Fire off the explanation request in parallel — use the caller-supplied
    // fenBefore when the blunder move has already been made (mobile drop flow).
    const preFen = fenBefore ?? currentFen();
    accumulateStream(
      postExplainStream,
      { fenBefore: preFen, fenAfter: blunderFen, isBlunder: true, moveSan: blunderSan },
      setHoverAdvice,
    ).catch((err) => console.error("Failed to fetch explanation stream", err));

    try {
      const fens: string[] = [blunderFen];
      const moves: (MoveSquares | null)[] = [null];

      const current = new Chess(blunderFen);
      for (let i = 0; i < 8; i++) {
        // Route through the shared pool. Travel is a user-initiated "Why?"
        // request, so it runs at interactive priority (preempts background work).
        const { bestMove } = await enginePool.evaluate({
          fen: current.fen(),
          depth: 12,
          priority: "interactive",
        });
        if (!bestMove) break;

        try {
          const from = bestMove.slice(0, 2);
          const to = bestMove.slice(2, 4);
          const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
          const result = current.move({ from, to, promotion });
          if (!result) break;

          fens.push(current.fen());
          moves.push({ from: result.from, to: result.to });

          if (current.isGameOver()) break;
        } catch {
          break;
        }
      }

      startTravel(fens, moves);
      // We don't overwrite hoverAdvice here so the LLM explanation stays visible
      setHoverEmotion("watching");
    } catch {
      setHoverAdvice("Failed to calculate a line.");
      setHoverEmotion("shocked");
    } finally {
      setLoading(false);
    }
  };

  return { activateTravel, loading };
}
