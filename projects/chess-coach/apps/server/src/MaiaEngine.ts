import { UciDriver } from "./UciDriver.ts";

/**
 * Maia/lc0 UCI wrapper with difficulty-based weight switching.
 * Mirrors the Kotlin MaiaEngine (_spec/api/behavior.md §7.1): OwnBook +
 * openings.bin, Temperature 0.5, `go nodes 1`, restart on difficulty change.
 * (No TempDecayMoves — that is the browser engine's variety mechanism.)
 */
export class MaiaEngine {
  private driver: UciDriver | null = null;
  private currentDifficulty: string | null = null;

  constructor(
    private readonly weightsDir: string = process.env.MAIA_WEIGHTS_DIR ?? "/app/weights",
    private readonly defaultTimeoutMs = 30_000,
  ) {}

  get isRunning(): boolean {
    return this.driver?.isRunning === true;
  }

  async getMove(fen: string, difficulty: string): Promise<string> {
    await this.ensureReady(difficulty);
    const d = this.driver;
    if (!d) throw new Error("Maia engine not started");

    d.send(`position fen ${fen}`);
    d.send("go nodes 1"); // Maia is a policy network; 1 node is enough

    const lines = await d.readUntil("bestmove", this.defaultTimeoutMs);
    let bestMove = "";
    for (const line of lines) {
      if (line.startsWith("bestmove")) {
        bestMove = line.split("bestmove ")[1]?.split(" ")[0]?.trim() ?? "";
      }
    }
    if (bestMove !== "") return bestMove;
    throw new Error("Maia did not return a bestmove");
  }

  private async ensureReady(difficulty: string): Promise<void> {
    if (this.driver && this.currentDifficulty === difficulty && this.driver.isRunning) return;

    this.stop();

    const weightsFile =
      difficulty === "advanced"
        ? "maia-1600.pb.gz"
        : difficulty === "expert"
          ? "maia-2200.pb.gz"
          : "maia-1100.pb.gz";

    console.error(`Starting lc0 with weights: ${weightsFile}`);

    const d = new UciDriver(
      ["lc0", `--weights=${this.weightsDir}/${weightsFile}`, "--backend=blas"],
      this.defaultTimeoutMs,
    );
    await d.start();

    d.send("setoption name OwnBook value true");
    d.send(`setoption name BookFile value ${this.weightsDir}/openings.bin`);
    d.send("setoption name Temperature value 0.5");
    d.send("isready");
    await d.waitFor("readyok", this.defaultTimeoutMs);

    this.driver = d;
    this.currentDifficulty = difficulty;
  }

  stop(): void {
    this.driver?.stop();
    this.driver = null;
    this.currentDifficulty = null;
  }
}
