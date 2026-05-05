export class UciDriver {
  private worker: Worker;
  private messageQueue: string[] = [];
  private resolvers: Array<(line: string) => void> = [];

  constructor(workerOrUrl: string | URL | Worker) {
    if (workerOrUrl instanceof Worker) {
      this.worker = workerOrUrl;
    } else {
      this.worker = new Worker(workerOrUrl);
    }

    this.worker.onmessage = (e) => {
      const line = e.data as string;
      if (this.resolvers.length > 0) {
        this.resolvers.shift()!(line);
      } else {
        this.messageQueue.push(line);
      }
    };
  }

  send(command: string) {
    this.worker.postMessage(command);
  }

  async readLine(timeoutMs: number = 15000): Promise<string> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift()!;
    }
    return new Promise((resolve, reject) => {
      // Splice the resolver out on timeout so a delayed worker message
      // can't get consumed by a dead handler — that previously poisoned
      // the driver: the awaited line was silently dropped instead of
      // being queued, and every subsequent read hung.
      const resolver = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      const timer = setTimeout(() => {
        const idx = this.resolvers.indexOf(resolver);
        if (idx !== -1) this.resolvers.splice(idx, 1);
        reject(new Error("UCI Timeout"));
      }, timeoutMs);
      this.resolvers.push(resolver);
    });
  }

  async readUntil(token: string, timeoutMs: number = 15000): Promise<string[]> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for '${token}'`);
      const line = await this.readLine(remaining);
      lines.push(line);
      if (line.includes(token)) return lines;
    }
    throw new Error(`Timed out waiting for '${token}'`);
  }

  stop() {
    this.worker.terminate();
  }
}
