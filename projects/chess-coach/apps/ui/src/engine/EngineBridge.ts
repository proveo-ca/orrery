// SPEC: _spec/chess-coach/ui/components.puml
import { MaiaEngine } from "~/engine/MaiaEngine.ts";
import { type EvalResult, StockfishEngine } from "~/engine/StockfishEngine.ts";

export class EngineBridge {
  // Full strength for coaching/evaluations
  private evaluator = new StockfishEngine();

  // Human-like neural network for playing
  private player = new MaiaEngine();

  async getEvaluation(fen: string, depth: number = 15): Promise<EvalResult> {
    return this.evaluator.getEvaluation(fen, depth);
  }

  async getFenAfterMove(fen: string, uciMove: string): Promise<string | null> {
    return this.evaluator.getFenAfterMove(fen, uciMove);
  }

  async getSanForUciMove(fen: string, uciMove: string): Promise<string | null> {
    return this.evaluator.getSanForUciMove(fen, uciMove);
  }

  async getAiMove(fen: string, difficulty: string): Promise<string> {
    // Map difficulty to Maia weights files
    let weightsFile = "maia-1100.pb.gz";
    if (difficulty === "advanced") weightsFile = "maia-1600.pb.gz";
    if (difficulty === "expert") weightsFile = "maia-2200.pb.gz";

    return this.player.getMove(fen, weightsFile);
  }
}
