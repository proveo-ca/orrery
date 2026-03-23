import { UciDriver } from "~/engine/UciDriver";

export class MaiaEngine {
  private driver: UciDriver;
  private isReady = false;
  private currentWeights = "";

  constructor() {
    const worker = new Worker(new URL("./maia.worker.ts", import.meta.url));
    this.driver = new UciDriver(worker);
  }

  async init(weightsFile: string) {
    if (this.isReady && this.currentWeights === weightsFile) return;

    // Send INIT to worker to load weights into VFS
    (this.driver as any).worker.postMessage({ type: "INIT", weightsFile });
    await this.driver.readUntil("readyok", 30000); // Wait for WASM + Weights to load

    this.driver.send("uci");
    await this.driver.readUntil("uciok");

    this.driver.send(`setoption name WeightsFile value ${weightsFile}`);
    this.driver.send("isready");
    await this.driver.readUntil("readyok");

    this.isReady = true;
    this.currentWeights = weightsFile;
  }

  async getMove(fen: string, weightsFile: string): Promise<string> {
    await this.init(weightsFile);

    this.driver.send(`position fen ${fen}`);
    this.driver.send("go nodes 1"); // Maia is a policy network, 1 node is enough

    const lines = await this.driver.readUntil("bestmove");
    const bestMoveLine = lines.find((l) => l.startsWith("bestmove"));

    if (!bestMoveLine) throw new Error("No bestmove found");
    return bestMoveLine.split(" ")[1];
  }
}
