import { UciDriver } from "./UciDriver.ts";

export type EvalResult = { bestMove: string; cp: number; isMate: boolean; mateIn: number };

/**
 * Stockfish UCI wrapper for evaluation, legality, and FEN derivation.
 * Mirrors the Kotlin StockfishEngine (_spec/api/behavior.md §7.2).
 */
export class StockfishEngine {
  private readonly driver: UciDriver;
  private readonly syzygyPath?: string;

  constructor(
    stockfishPath = "stockfish",
    private readonly defaultTimeoutMs = 15_000,
  ) {
    this.driver = new UciDriver([stockfishPath], defaultTimeoutMs);
    this.syzygyPath = process.env.SYZYGY_PATH || undefined;
  }

  async start(): Promise<void> {
    await this.driver.start();
    if (this.syzygyPath) {
      this.driver.send(`setoption name SyzygyPath value ${this.syzygyPath}`);
    }
  }

  stop(): void {
    this.driver.stop();
  }

  get isRunning(): boolean {
    return this.driver.isRunning;
  }

  async getEvaluation(fen: string, depth = 15): Promise<EvalResult> {
    this.driver.send(`position fen ${fen}`);
    this.driver.send(`go depth ${depth}`);

    let bestMove = "";
    let cp = 0;
    let isMate = false;
    let mateIn = 0;

    const lines = await this.driver.readUntil("bestmove", this.defaultTimeoutMs);
    for (const line of lines) {
      if (line.includes("score cp")) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) cp = parseInt(m[1], 10);
      } else if (line.includes("score mate")) {
        isMate = true;
        const m = line.match(/score mate (-?\d+)/);
        if (m) mateIn = parseInt(m[1], 10);
      }
      if (line.startsWith("bestmove")) {
        bestMove = line.split(" ")[1] ?? "";
      }
    }
    return { bestMove, cp, isMate, mateIn };
  }

  async checkLegality(fen: string, move: string): Promise<boolean> {
    this.driver.send(`position fen ${fen} moves ${move}`);
    this.driver.send("go depth 1");

    let isLegal = true;
    const lines = await this.driver.readUntil("bestmove", this.defaultTimeoutMs);
    for (const line of lines) {
      if (line.includes("Illegal move")) isLegal = false;
    }
    return isLegal;
  }

  async getFenAfterMove(fen: string, uciMove: string): Promise<string | null> {
    this.driver.send(`position fen ${fen} moves ${uciMove}`);
    this.driver.send("d");

    let newFen = "";
    const lines = await this.driver.readUntil("Checkers:", this.defaultTimeoutMs);
    for (const line of lines) {
      if (line.startsWith("Fen: ")) newFen = line.slice(5).trim();
    }

    if (newFen === fen || newFen === "") return null;
    return newFen;
  }
}
