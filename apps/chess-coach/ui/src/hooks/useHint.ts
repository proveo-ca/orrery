import { createSignal, onCleanup, onMount } from 'solid-js';

type PendingRequest = {
  resolve: (move: string) => void;
  reject: (err: Error) => void;
  timeoutId: number;
};

export function useHint(workerPath: string = '/stockfish-18-lite.js') {
  const [worker, setWorker] = createSignal<Worker | null>(null);
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
    const w = new Worker(workerPath);

    w.onmessage = (event) => {
      const raw = event.data;
      if (typeof raw !== 'string') return;

      if (!raw.startsWith('bestmove')) return;

      const move = raw.trim().split(/\s+/)[1] || '';
      if (!pending) return;

      const { resolve } = pending;
      cleanupPending();

      if (!move || move === '(none)') {
        resolve('');
        return;
      }

      resolve(move);
    };

    setWorker(w);
    w.postMessage('uci');
    w.postMessage('isready');
  });

  onCleanup(() => {
    cleanupPending(new Error('hint request cancelled (component unmounted)'));
    worker()?.terminate();
  });

  const requestHint = (fen: string, depth: number = 10): Promise<string> => {
    const w = worker();
    if (!w) return Promise.reject(new Error('hint engine not ready'));

    cleanupPending(new Error('hint request superseded by a new request'));

    setPendingHint(true);

    return new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanupPending(new Error('hint request timed out'));
      }, 12_000);

      pending = { resolve, reject, timeoutId };

      // Best-effort: stop any prior analysis and start a fresh search for this FEN.
      w.postMessage('stop');
      w.postMessage('ucinewgame');
      w.postMessage(`position fen ${fen}`);
      w.postMessage(`go depth ${depth}`);
    });
  };

  const stopHint = () => {
    worker()?.postMessage('stop');
    cleanupPending(new Error('hint request cancelled'));
  };

  return { requestHint, stopHint, pendingHint };
}
