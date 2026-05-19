import type { StockfishMessage } from "~/types/Stockfish";

const parseIntAfter = (tokens: string[], key: string): number | undefined => {
  const idx = tokens.indexOf(key);
  if (idx === -1) return undefined;
  const raw = tokens[idx + 1];
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
};

const parseInfo = (raw: string, tokens: string[]): Extract<StockfishMessage, { type: "info" }> => {
  const depth = parseIntAfter(tokens, "depth");
  const seldepth = parseIntAfter(tokens, "seldepth");
  const multipv = parseIntAfter(tokens, "multipv");

  let score: { kind: "cp" | "mate"; value: number } | undefined;
  const scoreIdx = tokens.indexOf("score");
  if (scoreIdx !== -1) {
    const kind = tokens[scoreIdx + 1] as "cp" | "mate" | undefined;
    const valueRaw = tokens[scoreIdx + 2];
    if ((kind === "cp" || kind === "mate") && valueRaw) {
      const value = parseInt(valueRaw, 10);
      if (Number.isFinite(value)) {
        score = { kind, value };
      }
    }
  }

  const pvIdx = tokens.indexOf("pv");
  const pv = pvIdx !== -1 ? tokens.slice(pvIdx + 1).filter(Boolean) : undefined;

  return { type: "info", depth, seldepth, multipv, score, pv, raw };
};

const parseBestMove = (
  raw: string,
  tokens: string[],
): Extract<StockfishMessage, { type: "bestmove" }> => {
  const move = tokens[1] || "";
  const ponderIdx = tokens.indexOf("ponder");
  const ponder = ponderIdx !== -1 ? tokens[ponderIdx + 1] : undefined;
  return { type: "bestmove", move, ponder, raw };
};

export function parseStockfishMessage(raw: string): StockfishMessage {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { type: "other", raw };
  }

  switch (tokens[0]) {
    case "info":
      return parseInfo(raw, tokens);
    case "bestmove":
      return parseBestMove(raw, tokens);
    case "uciok":
      return { type: "uciok", raw };
    case "readyok":
      return { type: "readyok", raw };
    default:
      return { type: "other", raw };
  }
}
