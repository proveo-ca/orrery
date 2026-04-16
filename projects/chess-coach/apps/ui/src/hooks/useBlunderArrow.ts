import { createEffect, on } from "solid-js";

import type { AnnotationTag } from "~/engine/moveAnnotations";
import { useHint } from "~/hooks/useHint";
import { setAdviceArrow } from "~/store/coachStore";
import { currentIndex, fenHistory } from "~/store/gameStore";

/**
 * Side-effect hook: when the board is viewing a blunder ply, fire a Stockfish
 * search on the pre-blunder position and display the best-move arrow. Clears
 * the arrow when navigating away.
 *
 * Decoupled from MoveList so the arrow works even if the move list isn't
 * mounted (e.g., on a mobile layout that hides the list but still shows the
 * board).
 */
export function useBlunderArrow(annotations: () => AnnotationTag[][]) {
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
        if (!tags || (!tags.includes("blunder") && !tags.includes("forced"))) return;

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
