// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onCleanup } from "solid-js";

import { enginePool } from "~/engine/EnginePool";

/**
 * On-demand Stockfish hint search, routed through the shared engine pool at
 * `interactive` priority so it preempts background work (review / live
 * pre-analysis). Supersede is just an `AbortController`: a new request aborts
 * the previous one, and the pool drains the stopped search's stale `bestmove`
 * internally — no more per-hook drain bookkeeping or dedicated Worker.
 *
 * `requestHint` never rejects: aborted/superseded/failed searches resolve to
 * `""` (treated as "no hint" by callers).
 */
export function useHint() {
  const [pendingHint, setPendingHint] = createSignal(false);

  let controller: AbortController | null = null;

  const cancel = () => {
    controller?.abort();
    controller = null;
    setPendingHint(false);
  };

  onCleanup(cancel);

  const requestHint = (fen: string, depth: number = 16): Promise<string> => {
    controller?.abort(); // supersede any in-flight request
    const ctrl = new AbortController();
    controller = ctrl;
    setPendingHint(true);

    return enginePool
      .evaluate({ fen, depth, priority: "interactive", signal: ctrl.signal })
      .then(
        (res) => res.bestMove ?? "",
        () => "",
      )
      .finally(() => {
        // Only the most recent request clears the shared pending flag; a
        // superseding request has already taken ownership of it.
        if (controller === ctrl) {
          controller = null;
          setPendingHint(false);
        }
      });
  };

  const stopHint = () => cancel();

  return { requestHint, stopHint, pendingHint };
}
