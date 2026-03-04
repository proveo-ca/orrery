class StockfishService {
  private worker: Worker | null = null;
  private listeners: Set<(event: MessageEvent) => void> = new Set();
  private workerPath: string = '/stockfish-18-lite.js';
  
  private watchdogTimer: number | null = null;
  private isSearching: boolean = false;

  getWorker(workerPath: string = '/stockfish-18-lite.js'): Worker {
    this.workerPath = workerPath;
    
    if (!this.worker) {
      console.log('[StockfishService] Initializing new worker instance...');
      this.worker = new Worker(workerPath);
      
      this.worker.onerror = (err) => {
        console.error('[StockfishService] Worker Error:', err.message, err);
        this.restartWorker();
      };

      this.worker.onmessage = (event) => {
        const raw = event.data;
        if (typeof raw === 'string') {
          // 2. Healthcheck logging
          if (raw === 'readyok' || raw === 'uciok') {
            console.log(`[StockfishService] Healthcheck OK: ${raw}`);
          }

          // 3. Watchdog: If we receive ANY message, the worker is alive.
          // Reset the 5s timeout if we are currently expecting something.
          if (this.isSearching) {
            this.startWatchdog(5000);
          }

          // Stop the watchdog when the search or healthcheck completes
          if (raw.startsWith('bestmove') || raw === 'readyok') {
            this.isSearching = false;
            this.clearWatchdog();
          }
        }

        for (const listener of this.listeners) {
          listener(event);
        }
      };

      this.worker.postMessage('uci');
      this.send('isready'); // Use send() to trigger the watchdog for the initial healthcheck
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
      console.error(`[StockfishService] Worker timed out after ${timeoutMs}ms of silence. Restarting...`);
      this.restartWorker();
    }, timeoutMs);
  }

  private restartWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.clearWatchdog();
    this.isSearching = false;
    
    // Broadcast a synthetic bestmove so any pending hooks (useHint, useTravelMode) 
    // don't hang forever waiting for a promise to resolve.
    const syntheticEvent = new MessageEvent('message', { data: 'bestmove (none)' });
    for (const listener of this.listeners) {
      listener(syntheticEvent);
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
    if (!this.worker) this.getWorker(this.workerPath);
    
    // Start watchdog for commands that expect a response
    if (command.startsWith('go ') || command === 'isready') {
      this.isSearching = true;
      this.startWatchdog(5000);
    } else if (command === 'stop') {
      this.isSearching = false;
      this.clearWatchdog();
    }

    this.worker?.postMessage(command);
  }
}

// 1. Ensure it is a singleton
export const stockfishService = new StockfishService();
