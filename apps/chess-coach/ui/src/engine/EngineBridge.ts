import { StockfishEngine, type EvalResult } from './StockfishEngine.ts';

export class EngineBridge {
  // Full strength for coaching/evaluations
  private evaluator = new StockfishEngine();
  
  // Limited strength for playing against the human
  private player = new StockfishEngine();

  async getEvaluation(fen: string, depth: number = 15): Promise<EvalResult> {
    return this.evaluator.getEvaluation(fen, depth);
  }

  async getFenAfterMove(fen: string, uciMove: string): Promise<string | null> {
    return this.evaluator.getFenAfterMove(fen, uciMove);
  }

  async getAiMove(fen: string, difficulty: string): Promise<string> {
    let elo = 1100;
    if (difficulty === 'advanced') elo = 1600;
    if (difficulty === 'expert') elo = 2200;
    
    return this.player.getMoveAtElo(fen, elo);
  }
}
