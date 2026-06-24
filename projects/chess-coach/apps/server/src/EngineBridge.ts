import { MaiaEngine } from "./MaiaEngine.ts";
import { type EvalResult, StockfishEngine } from "./StockfishEngine.ts";

export type { EvalResult };

/** The subset of EngineBridge the Orchestrator depends on (fakeable in tests). */
export interface IEngineBridge {
  getEvaluation(fen: string, depth?: number): Promise<EvalResult>;
  getFenAfterMove(fen: string, move: string): Promise<string | null>;
  getMaiaMove(fen: string, difficulty: string): Promise<string>;
}

/** Facade over Stockfish (eval/legality/FEN) + Maia (AI move). */
export class EngineBridge implements IEngineBridge {
  private readonly stockfish: StockfishEngine;
  private readonly maia: MaiaEngine;

  constructor(stockfishPath = "stockfish") {
    this.stockfish = new StockfishEngine(stockfishPath);
    this.maia = new MaiaEngine();
  }

  async start(): Promise<void> {
    await this.stockfish.start();
    // Maia starts lazily on first getMaiaMove()
  }

  stop(): void {
    this.stockfish.stop();
    this.maia.stop();
  }

  getEvaluation(fen: string, depth = 15): Promise<EvalResult> {
    return this.stockfish.getEvaluation(fen, depth);
  }

  checkLegality(fen: string, move: string): Promise<boolean> {
    return this.stockfish.checkLegality(fen, move);
  }

  getFenAfterMove(fen: string, uciMove: string): Promise<string | null> {
    return this.stockfish.getFenAfterMove(fen, uciMove);
  }

  getMaiaMove(fen: string, difficulty: string): Promise<string> {
    return this.maia.getMove(fen, difficulty);
  }
}
