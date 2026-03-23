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
      const timer = setTimeout(() => reject(new Error("UCI Timeout")), timeoutMs);
      this.resolvers.push((line) => {
        clearTimeout(timer);
        resolve(line);
      });
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
