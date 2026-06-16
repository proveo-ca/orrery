// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect, on, onCleanup } from "solid-js";

import { analyzeGameToCache } from "~/hooks/useGameAnalysis";
import { inProgressGame } from "~/store/gameHistoryStore";

/**
 * Warms the review analysis cache *during* the live game. Each time a move is
 * recorded, the in-progress game is (re-)analyzed through the shared engine
 * pool at background priority, persisting per-ply results under the
 * in-progress game's stable UUID. `finalizeGame` then migrates that cache to
 * the final review id, so by the time the player opens Review the work is
 * already done (or well underway).
 *
 * Because these jobs run at `background` priority, interactive searches (the
 * hover-blunder eval and hints, which now share the same pool) always preempt
 * them — the live coach never waits on bulk analysis.
 */
export function useLivePreAnalysis() {
  let controller: AbortController | null = null;
  const stop = () => {
    controller?.abort();
    controller = null;
  };
  onCleanup(stop);

  createEffect(
    on(
      () => {
        const g = inProgressGame();
        // Re-run whenever a new move lands (or a new game starts).
        return g ? `${g.id}:${g.moves.length}` : null;
      },
      () => {
        stop();
        const g = inProgressGame();
        if (!g || g.moves.length === 0) return;

        // Snapshot so the async pass operates on a fixed-length move list even
        // as the store keeps growing underneath it.
        const snapshot = { ...g, moves: [...g.moves] };
        controller = new AbortController();
        void analyzeGameToCache(snapshot, { signal: controller.signal }).catch(() => {});
      },
    ),
  );
}
