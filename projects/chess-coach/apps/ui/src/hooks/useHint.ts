import { createSignal, onCleanup, onMount } from "solid-js";

import { stockfishService } from "~/services/stockfishService";

type PendingRequest = {
  resolve: (move: string) => void;
  reject: (err: Error) => void;
  timeoutId: number;
};

export function useHint(workerPath: string = "/stockfish-18-lite.js") {
  const [pendingHint, setPendingHint] = createSignal(false);

  let pending: PendingRequest | null = null;

  const cleanupPending = (err?: Error) => {
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    if (err) pending.reject(err);
    pending = null;
    setPendingHint(false);
  };

  onMount(() => {
    stockfishService.getWorker(workerPath);

    const handleMessage = (event: MessageEvent) => {
      const raw = event.data;
      if (typeof raw !== "string") return;

      if (!raw.startsWith("bestmove")) return;

      const move = raw.trim().split(/\s+/)[1] || "";
      if (!pending) return;

      const { resolve } = pending;
      cleanupPending();

      if (!move || move === "(none)") {
        resolve("");
        return;
      }

      resolve(move);
    };

    stockfishService.addListener(handleMessage);

    onCleanup(() => {
      cleanupPending(new Error("hint request cancelled (component unmounted)"));
      stockfishService.removeListener(handleMessage);
    });
  });

  const requestHint = (fen: string, depth: number = 10): Promise<string> => {
    cleanupPending(new Error("hint request superseded by a new request"));

    setPendingHint(true);

    return new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanupPending(new Error("hint request timed out"));
      }, 12_000);

      pending = { resolve, reject, timeoutId };

      // Best-effort: stop any prior analysis and start a fresh search for this FEN.
      stockfishService.send("stop");
      stockfishService.send("ucinewgame");
      stockfishService.send(`position fen ${fen}`);
      stockfishService.send(`go depth ${depth}`);
    });
  };

  const stopHint = () => {
    stockfishService.send("stop");
    cleanupPending(new Error("hint request cancelled"));
  };

  return { requestHint, stopHint, pendingHint };
}
