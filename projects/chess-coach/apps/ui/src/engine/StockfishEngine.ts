// SPEC: _spec/chess-coach/ui/components.puml
import { UciDriver } from "~/engine/UciDriver.ts";

export type EvalResult = {
  bestMove: string;
  cp: number;
  isMate: boolean;
  mateIn: number;
  pv: string;
};

export const DEFAULT_STOCKFISH_WORKER_URL = import.meta.env.BASE_URL + "stockfish-18-lite.js";

export class StockfishEngine {
  private driver: UciDriver;

  constructor(workerUrl: string = DEFAULT_STOCKFISH_WORKER_URL) {
    this.driver = new UciDriver(workerUrl);
    this.driver.send("uci");
  }

  async getEvaluation(fen: string, depth: number = 15): Promise<EvalResult> {
    this.driver.send(`position fen ${fen}`);
    this.driver.send(`go depth ${depth}`);

    let bestMove = "";
    let cp = 0;
    let isMate = false;
    let mateIn = 0;
    let pv = "";

    const lines = await this.driver.readUntil("bestmove", 15000);
    for (const line of lines) {
      if (line.includes(" pv ")) {
        const match = line.match(/ pv (.*)/);
        if (match) pv = match[1].trim();
      }
      if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) cp = parseInt(match[1], 10);
      } else if (line.includes("score mate")) {
        isMate = true;
        const match = line.match(/score mate (-?\d+)/);
        if (match) mateIn = parseInt(match[1], 10);
      }
      if (line.startsWith("bestmove")) {
        bestMove = line.split(" ")[1];
      }
    }
    return { bestMove, cp, isMate, mateIn, pv };
  }

  async getMoveAtElo(fen: string, elo: number): Promise<string> {
    this.driver.send("setoption name UCI_LimitStrength value true");
    this.driver.send(`setoption name UCI_Elo value ${elo}`);
    this.driver.send(`position fen ${fen}`);
    this.driver.send("go depth 10");

    const lines = await this.driver.readUntil("bestmove", 15000);
    for (const line of lines) {
      if (line.startsWith("bestmove")) {
        return line.split(" ")[1].trim();
      }
    }
    throw new Error("Stockfish did not return a bestmove");
  }

  async getFenAfterMove(fen: string, uciMove: string): Promise<string | null> {
    this.driver.send(`position fen ${fen} moves ${uciMove}`);
    this.driver.send("d");

    const lines = await this.driver.readUntil("Checkers:", 5000);
    for (const line of lines) {
      if (line.startsWith("Fen: ")) {
        const newFen = line.substring(5).trim();
        return newFen === fen ? null : newFen;
      }
    }
    return null;
  }

  async getSanForUciMove(fen: string, uciMove: string): Promise<string | null> {
    this.driver.send(`position fen ${fen}`);
    this.driver.send("d");

    const lines = await this.driver.readUntil("Checkers:", 5000);
    for (const line of lines) {
      const match = line.match(/\b([a-h][1-8][a-h][1-8][nbrq]?)\s*:\s*([^\s].*?)\s*$/i);
      if (match) {
        const legalUci = match[1].trim();
        const san = match[2].trim();
        if (legalUci === uciMove) {
          return san;
        }
      }
    }
    return null;
  }
}
