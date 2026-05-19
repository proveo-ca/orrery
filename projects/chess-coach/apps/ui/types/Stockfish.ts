export type StockfishMessage =
  | {
      type: "info";
      depth?: number;
      seldepth?: number;
      multipv?: number;
      score?: { kind: "cp" | "mate"; value: number };
      pv?: string[];
      raw: string;
    }
  | {
      type: "bestmove";
      move: string;
      ponder?: string;
      raw: string;
    }
  | { type: "uciok"; raw: string }
  | { type: "readyok"; raw: string }
  | { type: "other"; raw: string };

export type StockfishAnalysis = {
  last: StockfishMessage | null;
  lastInfo: Extract<StockfishMessage, { type: "info" }> | null;
  lastBestMove: Extract<StockfishMessage, { type: "bestmove" }> | null;
};
