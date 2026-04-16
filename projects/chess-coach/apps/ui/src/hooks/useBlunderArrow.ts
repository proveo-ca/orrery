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

  createEffect(
    on(
      () => currentIndex(),
      (idx) => {
        setAdviceArrow(null);
        stopHint();

        if (idx <= 0) return;
        const plyIndex = idx - 1;
        const tags = annotations()[plyIndex];
        if (!tags) return;

        const isBlunder = tags.includes("blunder") || tags.includes("forced");
        const isInaccuracy = tags.includes("inaccuracy");
        if (!isBlunder && !isInaccuracy) return;

        // Try cached best-move first (always available for inaccuracies,
        // usually available for blunders once analysis is complete).
        const cachedUci = bestMoveUcis()[plyIndex];
        if (cachedUci && cachedUci.length >= 4) {
          setAdviceArrow({ from: cachedUci.slice(0, 2), to: cachedUci.slice(2, 4) });
          return;
        }

        // Fallback: live Stockfish search (blunders only — inaccuracies
        // require a cached UCI so they never reach here).
        if (!isBlunder) return;
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
      },
    ),
  );
}
