import { Chess } from "chess.js";

export function uciMatchesSan(fen: string, uciMove: string, sanMove: string): boolean {
  if (!uciMove || !sanMove) return false;

  try {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    return legalMoves.some((move) => {
      const moveUci = `${move.from}${move.to}${move.promotion ?? ""}`;
      return moveUci === uciMove && move.san === sanMove;
    });
  } catch {
    return false;
  }
}
