// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onCleanup, onMount } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { stockfishService } from "~/services/stockfishService";
import { logger } from "~/utils/logger";

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

export function useStockfishWorker(workerPath: string = DEFAULT_STOCKFISH_WORKER_URL) {
  const [analysis, setAnalysis] = createSignal<StockfishAnalysis>({
    last: null,
    lastInfo: null,
    lastBestMove: null,
  });

  const send = (command: string) => {
    stockfishService.send(command);
  };

  onMount(() => {
    stockfishService.getWorker(workerPath);

    const handleMessage = (event: MessageEvent) => {
      const raw = event.data;
      if (typeof raw !== "string") return;

      logger.action("[SF]", raw.trim());

      const tokens = raw.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return;

      let msg: StockfishMessage;
      switch (tokens[0]) {
        case "info":
          msg = parseInfo(raw, tokens);
          break;
        case "bestmove":
          msg = parseBestMove(raw, tokens);
          break;
        case "uciok":
          msg = { type: "uciok", raw };
          break;
        case "readyok":
          msg = { type: "readyok", raw };
          break;
        default:
          msg = { type: "other", raw };
          break;
      }

      setAnalysis((prev) => ({
        last: msg,
        lastInfo: msg.type === "info" && msg.score ? msg : prev.lastInfo,
        lastBestMove: msg.type === "bestmove" ? msg : prev.lastBestMove,
      }));
    };

    stockfishService.addListener(handleMessage);

    onCleanup(() => {
      stockfishService.removeListener(handleMessage);
    });
  });

  return { analysis, send };
}
