// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onCleanup, onMount } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { parseStockfishMessage } from "~/utils/stockfishParser";
import type { StockfishAnalysis, StockfishMessage } from "~/types/Stockfish";
import { stockfishService } from "~/services/stockfishService";
import { logger } from "~/utils/logger";

export type { StockfishMessage, StockfishAnalysis };

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

      const msg = parseStockfishMessage(raw);

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
