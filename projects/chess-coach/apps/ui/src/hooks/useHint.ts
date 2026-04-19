// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onCleanup, onMount } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";

/**
 * Hint request state. `drainCount` is the number of stale `bestmove` replies
 * to ignore before accepting the next one as our answer — see the drain logic
 * in the worker's onmessage handler.
 */
type PendingRequest = {
  resolve: (move: string) => void;
  reject: (err: Error) => void;
  timeoutId: number;
  drainCount: number;
};

/**
 * On-demand Stockfish hint search. Owns a dedicated Worker so it has a 1:1
 * UCI pipe with the engine (per UCI spec, the protocol assumes a single GUI
 * driving a single engine). Sharing a Worker with the continuous-analysis
 * flow in `useChessBoard` caused the `a2a3/a7a6` stale-bestmove bug because
 * both consumers' commands and replies interleaved on the same pipe with no
 * way to correlate them.
 *
 * Supersede correctness: when a new requestHint arrives while a previous
 * search is in flight, our `stop` kills the old search and Stockfish emits
 * the old search's `bestmove` (the stop-response, typically a shallow move).
 * Per-pending `drainCount` tells the listener how many such stale bestmoves
 * to discard before accepting its own `bestmove`.
 */
export function useHint(workerPath: string = DEFAULT_STOCKFISH_WORKER_URL) {
  const [pendingHint, setPendingHint] = createSignal(false);

  let worker: Worker | null = null;
  let pending: PendingRequest | null = null;
  // Number of `go` commands we've queued that haven't been acknowledged
  // with a `bestmove` yet. Used to compute drainCount for the next request.
  let activeSearches = 0;

  const cleanupPending = (err?: Error) => {
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    if (err) pending.reject(err);
    pending = null;
    setPendingHint(false);
  };

  // Lazy-init: only create the Worker when the first hint is actually
  // requested. Multiple components mount useGameControls (Sidebar,
  // MobileDrawer) → each gets its own useHint. Eagerly creating a full
  // Stockfish WASM Worker per instance at mount would starve the
  // singleton analysis worker of CPU (WASM compilation is heavy).
  const ensureWorker = () => {
    if (worker) return;

    worker = new Worker(workerPath);
    worker.postMessage("uci");
    worker.postMessage("isready");

    worker.onmessage = (event: MessageEvent) => {
      const raw = event.data;
      if (typeof raw !== "string") return;
      if (!raw.startsWith("bestmove")) return;

      // Every `go` we sent produces exactly one `bestmove` in return —
      // either from search completion or from a subsequent `stop`. So each
      // incoming bestmove matches one of our pending or superseded
      // searches, in FIFO order.
      activeSearches = Math.max(0, activeSearches - 1);

      if (!pending) return;

      if (pending.drainCount > 0) {
        pending.drainCount--;
        return;
      }

      const move = raw.trim().split(/\s+/)[1] || "";
      const { resolve } = pending;
      clearTimeout(pending.timeoutId);
      pending = null;
      setPendingHint(false);
      resolve(!move || move === "(none)" ? "" : move);
    };
  };

  onMount(() => {
    onCleanup(() => {
      cleanupPending(new Error("hint request cancelled (component unmounted)"));
      worker?.terminate();
      worker = null;
    });
  });

  const requestHint = (fen: string, depth: number = 16): Promise<string> => {
    cleanupPending(new Error("hint request superseded by a new request"));
    setPendingHint(true);

    return new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanupPending(new Error("hint request timed out"));
      }, 12_000);

      // Any searches currently in flight will each produce a `bestmove`
      // before our new one does (our `stop` kills the latest one; earlier
      // supersedes already killed their predecessors). Discard that many.
      const drainCount = activeSearches;
      activeSearches++;

      pending = { resolve, reject, timeoutId, drainCount };

      ensureWorker();
      worker!.postMessage("stop");
      worker!.postMessage("ucinewgame");
      worker!.postMessage(`position fen ${fen}`);
      worker!.postMessage(`go depth ${depth}`);
    });
  };

  const stopHint = () => {
    if (worker) worker.postMessage("stop");
    cleanupPending(new Error("hint request cancelled"));
  };

  return { requestHint, stopHint, pendingHint };
}
