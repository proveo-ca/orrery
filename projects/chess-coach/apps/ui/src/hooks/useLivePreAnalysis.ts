// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect, on, onCleanup } from "solid-js";

import { analyzeGameToCache } from "~/hooks/useGameAnalysis";
import { inProgressGame } from "~/store/gameHistoryStore";

/**
 * Warms the review analysis cache *during* the live game. As moves are
 * recorded, the in-progress game is analyzed through the shared engine pool at
 * background priority, persisting per-ply results under the in-progress game's
 * stable UUID. `finalizeGame` then migrates that cache to the final review id,
 * so opening Review afterwards is instant (or well underway).
 *
 * Because these jobs run at `background` priority, interactive searches (hover
 * eval, hints) and the `normal` best-move-arrow analysis always preempt them —
 * the live coach never waits on bulk analysis.
 *
 * Crucially this COALESCES rather than abort-restarts: a new move never throws
 * away an in-flight ply. We run one `analyzeGameToCache` pass at a time (each
 * pass persists every completed ply and skips already-cached ones); moves that
 * land mid-pass set a dirty flag that triggers exactly one more pass. Aborting
 * on every move — as a naive `on(moveCount)` → restart would — meant that under
 * the constant preemption of live play no ply ever survived to completion, so
 * nothing was ever persisted.
 */
export function useLivePreAnalysis() {
  let abort: AbortController | null = null;
  let running = false;
  let dirty = false;
  let activeId: string | null = null;

  onCleanup(() => {
    abort?.abort();
    abort = null;
    running = false;
    dirty = false;
    activeId = null;
  });

  const pump = async () => {
    if (running) {
      // A pass is already in flight; let it finish, then sweep again for any
      // plies that landed in the meantime.
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        const g = inProgressGame();
        if (!g || g.moves.length === 0) break;
        activeId = g.id;
        abort = new AbortController();
        try {
          // Snapshot so the pass works on a fixed-length move list even as the
          // store grows underneath it. Re-seeds from cache, so completed plies
          // are skipped and only the new ones are searched.
          await analyzeGameToCache({ ...g, moves: [...g.moves] }, { signal: abort.signal });
        } catch {
          // Aborted (new game / unmount) or a worker fault for some ply — fall
          // through and let the loop re-check `dirty`.
        }
      } while (dirty);
    } finally {
      running = false;
      abort = null;
    }
  };

  createEffect(
    on(
      () => {
        const g = inProgressGame();
        // Re-evaluate whenever a move lands or a new game starts.
        return g ? `${g.id}:${g.moves.length}` : null;
      },
      () => {
        const g = inProgressGame();
        // A new game replaced the in-progress slot → abort the stale pass so
        // the loop re-targets the new game instead of churning the old one.
        if (g && activeId && g.id !== activeId) abort?.abort();
        void pump();
      },
    ),
  );
}
