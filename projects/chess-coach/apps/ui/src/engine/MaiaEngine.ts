// SPEC: _spec/chess-coach/ui/components.puml
import type { Difficulty } from "~/types/settings";
import { UciDriver } from "~/engine/UciDriver";

/**
 * Wrapper around the Maia (lc0) WASM chess engine running in a Web Worker.
 *
 * lc0.wasm can crash with unrecoverable RuntimeErrors (unaligned memory
 * access, stack overflow) that leave the worker in a zombie state. Every
 * subsequent UCI command goes unanswered, so `readUntil` hangs until
 * timeout. To recover, `getMove` catches any failure, terminates the
 * corrupted worker, spins up a fresh one, re-initialises it with the
 * current weights, and retries the move request once.
 */
export class MaiaEngine {
  private driver: UciDriver;
  private isReady = false;
  private currentWeights = "";

  constructor() {
    this.driver = this.createDriver();
  }

  private createDriver(): UciDriver {
    return new UciDriver(new Worker(new URL("./maia.worker.ts", import.meta.url)));
  }

  private restart() {
    console.warn("[MaiaEngine] Restarting worker after error...");
    this.driver.stop(); // terminates the zombie worker
    this.driver = this.createDriver();
    this.isReady = false;
    this.currentWeights = "";
  }

  async init(weightsFile: string) {
    if (this.isReady && this.currentWeights === weightsFile) return;

    // Send INIT to worker to load weights into VFS
    (this.driver as any).worker.postMessage({ type: "INIT", weightsFile });
    await this.driver.readUntil("readyok", 30000); // Wait for WASM + Weights to load

    this.driver.send("uci");
    await this.driver.readUntil("uciok");

    // Worker pre-decompresses .gz → .pb for VFS compatibility
    const vfsName = weightsFile.replace(/\.gz$/, "");
    this.driver.send(`setoption name WeightsFile value ${vfsName}`);
    this.driver.send("setoption name Temperature value 0.5");
    this.driver.send("setoption name TempDecayMoves value 15");
    this.driver.send("isready");
    await this.driver.readUntil("readyok");

    this.isReady = true;
    this.currentWeights = weightsFile;
  }

  /**
   * Get a move from the Maia engine. If the worker crashes (WASM
   * RuntimeError, stack overflow, etc.), restarts it and retries once.
   * A second failure propagates to the caller.
   */
  async getMove(fen: string, weightsFile: string, difficulty?: Difficulty): Promise<string> {
    try {
      return await this.executeGetMove(fen, weightsFile, difficulty);
    } catch (err) {
      console.warn(
        `[MaiaEngine] getMove failed (weights=${weightsFile}, fen=${fen}), restarting:`,
        err,
      );
      this.restart();
      try {
        return await this.executeGetMove(fen, weightsFile, difficulty);
      } catch (retryErr) {
        console.error(
          `[MaiaEngine] getMove failed again after restart (weights=${weightsFile}, fen=${fen}):`,
          retryErr,
        );
        throw retryErr;
      }
    }
  }

  private getDecay(difficulty?: Difficulty): number {
    if (difficulty === "advanced") return 12;
    if (difficulty === "expert") return 10;
    return 15;
  }

  private async executeGetMove(
    fen: string,
    weightsFile: string,
    difficulty?: Difficulty,
  ): Promise<string> {
    await this.init(weightsFile);

    const decay = this.getDecay(difficulty);
    this.driver.send(`setoption name TempDecayMoves value ${decay}`);

    this.driver.send(`position fen ${fen}`);
    this.driver.send("go nodes 1"); // Maia is a policy network, 1 node is enough

    // 5 s timeout — `go nodes 1` should return near-instantly. If it
    // doesn't, the worker is dead and we should fail fast so `getMove`
    // can restart and retry.
    const lines = await this.driver.readUntil("bestmove", 5000);
    const bestMoveLine = lines.find((l) => l.startsWith("bestmove"));

    if (!bestMoveLine) throw new Error("No bestmove found");
    return bestMoveLine.split(" ")[1];
  }
}
