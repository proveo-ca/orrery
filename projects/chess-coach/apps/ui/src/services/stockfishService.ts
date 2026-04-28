// SPEC: _spec/chess-coach/ui/components.puml
import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine";

// Circuit breaker so a worker that keeps faulting can't pin the CPU and
// balloon RAM by being respawned in a tight terminate/respawn loop.
const RESTART_WINDOW_MS = 10_000;
const MAX_RESTARTS_PER_WINDOW = 3;

class StockfishService {
  private worker: Worker | null = null;
  private listeners: Set<(event: MessageEvent) => void> = new Set();
  private workerPath: string = DEFAULT_STOCKFISH_WORKER_URL;

  private watchdogTimer: number | null = null;
  private isSearching: boolean = false;

  private restartCount = 0;
  private restartWindowStart = 0;
  private givenUp = false;

  getWorker(workerPath: string = DEFAULT_STOCKFISH_WORKER_URL): Worker {
    this.workerPath = workerPath;

    if (this.givenUp) {
      throw new Error(
        "[StockfishService] Engine disabled after repeated init failures (likely wasm memory exhaustion). Reload the page to retry.",
      );
    }

    if (!this.worker) {
      console.log("[StockfishService] Initializing new worker instance...", {
        workerPath,
        userAgent: navigator.userAgent,
      });

      const worker = new Worker(workerPath);
      this.worker = worker;

      worker.onerror = (err) => {
        // Drop stale errors emitted by an already-terminated worker so
        // residual events from a previous instance can't terminate the
        // newly-spawned successor.
        if (this.worker !== worker) return;

        console.error("[StockfishService] Worker Error:", {
          message: err.message,
          filename: err.filename,
          lineno: err.lineno,
          colno: err.colno,
          error: err.error,
          errorName: err.error?.name,
          errorMessage: err.error?.message,
          errorStack: err.error?.stack,
        });
        this.restartWorker();
      };

      worker.onmessageerror = (event) => {
        if (this.worker !== worker) return;
        console.error("[StockfishService] Worker MessageError:", event);
      };

      worker.onmessage = (event) => {
        if (this.worker !== worker) return;
        const raw = event.data;
        if (typeof raw === "string") {
          // Stockfish's pthread workers forward stderr lines as "Thread N: ..."
          // strings via printErr. Surface them so we can see why a child died.
          if (raw.startsWith("Thread ") || raw.includes("worker sent an error")) {
            console.error(`[StockfishService] Child stderr: ${raw}`);
          }

          // 2. Healthcheck logging
          if (raw === "readyok" || raw === "uciok") {
            console.log(`[StockfishService] Healthcheck OK: ${raw}`);
          }

          // 3. Watchdog: If we receive ANY message, the worker is alive.
          // Reset the 5s timeout if we are currently expecting something.
          if (this.isSearching) {
            this.startWatchdog(30000);
          }

          // Stop the watchdog when the search or healthcheck completes
          if (raw.startsWith("bestmove") || raw === "readyok") {
            this.isSearching = false;
            this.clearWatchdog();
          }
        }

        for (const listener of this.listeners) {
          listener(event);
        }
      };

      this.worker.postMessage("uci");
      this.send("isready"); // Use send() to trigger the watchdog for the initial healthcheck
    }
    return this.worker;
  }

  private clearWatchdog() {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private startWatchdog(timeoutMs: number) {
    this.clearWatchdog();
    this.watchdogTimer = window.setTimeout(() => {
      console.error(
        `[StockfishService] Worker timed out after ${timeoutMs}ms of silence. Restarting...`,
      );
      this.restartWorker();
    }, timeoutMs);
  }

  /** Detach handlers and kill the worker so its drain-events can't re-enter. */
  private killCurrentWorker() {
    if (!this.worker) return;
    this.worker.onerror = null;
    this.worker.onmessage = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.worker = null;
  }

  private giveUp(reason: string) {
    this.givenUp = true;
    this.killCurrentWorker();
    this.clearWatchdog();
    this.isSearching = false;
    console.error(
      `[StockfishService] Engine disabled (${reason}) — reload the page to retry.`,
    );
    // Unblock any pending consumers.
    const syntheticEvent = new MessageEvent("message", { data: "bestmove (none)" });
    for (const listener of this.listeners) listener(syntheticEvent);
  }

  private restartWorker() {
    this.killCurrentWorker();
    this.clearWatchdog();
    this.isSearching = false;

    // Broadcast a synthetic bestmove so any pending hooks (useHint, useTravelMode)
    // don't hang forever waiting for a promise to resolve.
    const syntheticEvent = new MessageEvent("message", { data: "bestmove (none)" });
    for (const listener of this.listeners) listener(syntheticEvent);

    // Circuit-breaker: roll the restart counter, refuse to respawn once the
    // budget is exhausted in the current window.
    const now = Date.now();
    if (now - this.restartWindowStart > RESTART_WINDOW_MS) {
      this.restartCount = 0;
      this.restartWindowStart = now;
    }
    this.restartCount += 1;
    if (this.restartCount > MAX_RESTARTS_PER_WINDOW) {
      this.giveUp(`${this.restartCount} restarts in ${RESTART_WINDOW_MS}ms`);
      return;
    }

    // Recreate the worker
    this.getWorker(this.workerPath);
  }

  addListener(listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  send(command: string) {
    if (this.givenUp) return;
    if (!this.worker) this.getWorker(this.workerPath);

    // Start watchdog for commands that expect a response
    if (command.startsWith("go ") || command === "isready") {
      this.isSearching = true;
      this.startWatchdog(30000);
    } else if (command === "stop") {
      this.isSearching = false;
      this.clearWatchdog();
    }

    this.worker?.postMessage(command);
  }
}

// 1. Ensure it is a singleton
export const stockfishService = new StockfishService();
