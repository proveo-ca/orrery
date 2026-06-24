import type { Subprocess } from "bun";

export class UciTimeoutError extends Error {}

/**
 * UCI process driver over Bun.spawn — the server-side analogue of the
 * Kotlin UciDriver (_spec/api/behavior.md §7.3) and the browser's
 * worker-based UciDriver. Background stdout reader → queue, stderr drain,
 * timeout-aware reads with the splice-on-timeout fix so a late line can't
 * poison a subsequent read.
 */
export class UciDriver {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private queue: string[] = [];
  private resolvers: Array<(line: string) => void> = [];

  constructor(
    private readonly cmd: string[],
    private readonly defaultTimeoutMs: number = 15_000,
  ) {}

  get isRunning(): boolean {
    return this.proc != null && !this.proc.killed;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    const proc = Bun.spawn(this.cmd, { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    this.proc = proc;
    this.queue = [];
    this.resolvers = [];
    void this.pumpStdout(proc.stdout);
    void this.drainStderr(proc.stderr);
    // UCI handshake
    this.send("uci");
    await this.waitFor("uciok");
  }

  private async pumpStdout(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          this.push(line);
        }
      }
    } catch {
      // process closed
    }
  }

  private async drainStderr(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true }).trimEnd();
        if (text) console.error(`[${this.cmd[0]}] ${text}`);
      }
    } catch {
      // process closed
    }
  }

  private push(line: string): void {
    const resolver = this.resolvers.shift();
    if (resolver) resolver(line);
    else this.queue.push(line);
  }

  send(command: string): void {
    const proc = this.proc;
    if (!proc) throw new Error("UCI driver not started");
    proc.stdin.write(`${command}\n`);
    proc.stdin.flush();
  }

  readLine(timeoutMs: number = this.defaultTimeoutMs): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise<string>((resolve, reject) => {
      const resolver = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      const timer = setTimeout(() => {
        const idx = this.resolvers.indexOf(resolver);
        if (idx !== -1) this.resolvers.splice(idx, 1);
        reject(new UciTimeoutError("UCI timeout"));
      }, timeoutMs);
      this.resolvers.push(resolver);
    });
  }

  async waitFor(token: string, timeoutMs: number = this.defaultTimeoutMs): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new UciTimeoutError(`Timed out waiting for '${token}'`);
      const line = await this.readLine(remaining);
      if (line.includes(token)) return line;
    }
  }

  async readUntil(stopToken: string, timeoutMs: number = this.defaultTimeoutMs): Promise<string[]> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new UciTimeoutError(`Timed out waiting for '${stopToken}'`);
      const line = await this.readLine(remaining);
      lines.push(line);
      if (line.includes(stopToken)) return lines;
    }
  }

  stop(): void {
    try {
      this.send("quit");
    } catch {
      // already gone
    }
    try {
      this.proc?.kill();
    } catch {
      // already gone
    }
    this.proc = null;
    this.queue = [];
    this.resolvers = [];
  }
}
