import { Chess } from "chess.js";
import { createSignal } from "solid-js";

import { postExplainStream } from "~/services/api";
import { stockfishService } from "~/services/stockfishService";
import { setHoverAdvice, setHoverEmotion } from "~/store/coachStore";
import { type MoveSquares, currentFen } from "~/store/gameStore";
import { startTravel } from "~/store/travelStore";
import {DEFAULT_STOCKFISH_WORKER_URL} from "~/engine/StockfishEngine.ts";

/**
 * Requests the best line (PV) from a dedicated Stockfish worker,
 * then plays it out move-by-move to build a fake timeline.
 */
export function useTravelMode(workerPath: string = DEFAULT_STOCKFISH_WORKER_URL) {
  const [loading, setLoading] = createSignal(false);

  const requestPV = (fen: string, depth: number = 12): Promise<string[]> => {
    stockfishService.getWorker(workerPath);

    return new Promise<string[]>((resolve) => {
      let bestPV: string[] = [];
      let isFlushing = true; // Ignore messages until we see 'readyok'

      const handler = (event: MessageEvent) => {
        const raw = event.data;
        if (typeof raw !== "string") return;

        if (isFlushing) {
          if (raw === "readyok") {
            isFlushing = false;
            // Now that the queue is flushed, start the actual search
            stockfishService.send("ucinewgame");
            stockfishService.send(`position fen ${fen}`);
            stockfishService.send(`go depth ${depth}`);
          }
          return; // Ignore stray 'bestmove' from previous searches
        }

        const tokens = raw.trim().split(/\s+/);

        if (tokens[0] === "info") {
          const pvIdx = tokens.indexOf("pv");
          if (pvIdx !== -1) {
            const pv = tokens.slice(pvIdx + 1);
            if (pv.length > bestPV.length) {
              bestPV = pv;
            }
          }
        }

        if (tokens[0] === "bestmove") {
          stockfishService.removeListener(handler);
          // If PV was empty, use the bestmove itself
          if (bestPV.length === 0 && tokens[1] && tokens[1] !== "(none)") {
            bestPV = [tokens[1]];
          }
          resolve(bestPV);
        }
      };

      stockfishService.addListener(handler);

      // Stop current search and queue an 'isready' ping.
      // The worker will output the old 'bestmove' followed by 'readyok'.
      stockfishService.send("stop");
      stockfishService.send("isready");
    });
  };

  const activateTravel = async (blunderFen: string, blunderSan: string) => {
    setLoading(true);
    setHoverAdvice("Travelling to the future...");
    setHoverEmotion("thinking");

    // Lock the board immediately so mouse movements don't clear the hover state
    startTravel([blunderFen], [null]);

    // Fire off the explanation request in parallel
    let fullExplanation = "";
    let receivedFirstChunk = false;

    postExplainStream(
      { fenBefore: currentFen(), fenAfter: blunderFen, isBlunder: true, moveSan: blunderSan },
      (chunk) => {
        if (!receivedFirstChunk) {
          fullExplanation = ""; // Clear "Travelling..." on first token
          receivedFirstChunk = true;
        }
        fullExplanation += chunk;
        setHoverAdvice(fullExplanation);
      },
    ).catch((err) => console.error("Failed to fetch explanation stream", err));

    try {
      const pv = await requestPV(blunderFen, 12);
      // Take up to 8 moves, or fewer if the PV is shorter (e.g. mate in 1)
      const movesToPlay = pv.slice(0, 8);

      if (movesToPlay.length === 0) {
        setHoverAdvice("Could not calculate a line.");
        setHoverEmotion("shocked");
        setLoading(false);
        return;
      }

      const fens: string[] = [blunderFen];
      const moves: (MoveSquares | null)[] = [null];

      let current = new Chess(blunderFen);
      for (const uci of movesToPlay) {
        try {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length > 4 ? uci[4] : undefined;
          const result = current.move({ from, to, promotion });
          if (!result) break;
          fens.push(current.fen());
          moves.push({ from: result.from, to: result.to });
          // Stop early if the game is over (checkmate, stalemate, etc.)
          if (current.isGameOver()) break;
        } catch {
          break;
        }
      }

      startTravel(fens, moves);
      // We don't overwrite hoverAdvice here so the LLM explanation stays visible
      setHoverEmotion("watching");
    } catch {
      setHoverAdvice("Failed to calculate line.");
      setHoverEmotion("shocked");
    } finally {
      setLoading(false);
    }
  };

  return { activateTravel, loading };
}
