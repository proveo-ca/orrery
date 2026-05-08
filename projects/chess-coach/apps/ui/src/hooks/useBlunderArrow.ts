// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect, on } from "solid-js";

import type { AnnotationTag } from "~/engine/moveAnnotations";
import { useHint } from "~/hooks/useHint";
import { setAdviceArrow } from "~/store/coachStore";
import { currentIndex, fenHistory } from "~/store/gameStore";

/**
 * Side-effect hook: when the board is viewing a blunder or inaccuracy ply,
 * display the engine's best-move arrow on the board.
 *
 * For inaccuracies the best move is read directly from the cached
 * `bestMoveUcis` (no extra Stockfish call). For blunders the cached UCI is
 * also used when available; falls back to a live `requestHint` otherwise.
 */
export function useBlunderArrow(
  annotations: () => AnnotationTag[][],
  bestMoveUcis: () => (string | null)[],
) {
  const { requestHint, stopHint } = useHint();

  // Track currentIndex, annotations, AND bestMoveUcis so the arrow updates
  // when progressive analysis catches up to the viewed ply (not just on
  // navigation). Without this, navigating to a blunder before analysis
  // reaches it would silently miss the arrow because `on(currentIndex)`
  // alone never re-fires when the annotation data arrives later.
  createEffect(
    on([() => currentIndex(), annotations, bestMoveUcis], ([idx, annots, bestMoves], prev) => {
      const indexChanged = !prev || prev[0] !== idx;

      // Only clear arrow / cancel in-flight hint when the user navigated.
      if (indexChanged) {
        setAdviceArrow(null);
        stopHint();
      }

      if (idx <= 0) return;
      const plyIndex = idx - 1;
      const tags = annots[plyIndex];
      if (!tags) return;

      const isBlunder = tags.includes("blunder") || tags.includes("forced");
      const isInaccuracy = tags.includes("inaccuracy");
      if (!isBlunder && !isInaccuracy) return;

      // Try cached best-move first (always available for inaccuracies,
      // usually available for blunders once analysis is complete).
      const cachedUci = bestMoves[plyIndex];
      if (cachedUci && cachedUci.length >= 4) {
        stopHint();
        setAdviceArrow({ from: cachedUci.slice(0, 2), to: cachedUci.slice(2, 4) });
        return;
      }

      // Fallback: live Stockfish search (blunders only, only on navigation —
      // if analysis is still running it will eventually provide the cached
      // UCI and the effect will re-fire via the tracked bestMoveUcis).
      if (!isBlunder || !indexChanged) return;
      const fens = fenHistory();
      const fenBefore = fens[plyIndex];
      if (!fenBefore) return;

      requestHint(fenBefore, 12)
        .then((uci) => {
          if (currentIndex() !== idx || !uci || uci.length < 4) return;
          setAdviceArrow({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
          });
        })
        .catch(() => {});
    }),
  );
}
