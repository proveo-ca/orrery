import { Chess } from "chess.js";
import { createSignal } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { UciDriver } from "~/engine/UciDriver.ts";
import { postExplainStream } from "~/services/api";
import { setHoverAdvice, setHoverEmotion } from "~/store/coachStore";
import { type MoveSquares, currentFen } from "~/store/gameStore";
import { startTravel } from "~/store/travelStore";

/**
 * Requests the best line (PV) from a dedicated Stockfish worker,
 * then plays it out move-by-move to build a fake timeline.
 */
export function useTravelMode(workerPath: string = DEFAULT_STOCKFISH_WORKER_URL) {
  const [loading, setLoading] = createSignal(false);

  const getBestUci = async (
    driver: UciDriver,
    fen: string,
    depth: number = 12,
  ): Promise<string> => {
    driver.send("ucinewgame");
    driver.send(`position fen ${fen}`);
    driver.send(`go depth ${depth}`);

    const lines = await driver.readUntil("bestmove", 15000);
    for (const line of lines) {
      if (line.startsWith("bestmove")) {
        const tokens = line.trim().split(/\s+/);
        const uci = tokens[1];
        return uci && uci !== "(none)" ? uci : "";
      }
    }
    return "";
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

    const driver = new UciDriver(workerPath);
    driver.send("uci"); // Ensure initialized

    try {
      const fens: string[] = [blunderFen];
      const moves: (MoveSquares | null)[] = [null];

      let current = new Chess(blunderFen);
      for (let i = 0; i < 8; i++) {
        const uci = await getBestUci(driver, current.fen());
        if (!uci) break;

        try {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length > 4 ? uci[4] : undefined;
          const result = current.move({ from, to, promotion });
          if (!result) break;

          fens.push(current.fen());
          moves.push({ from: result.from, to: result.to });

          if (current.isGameOver()) break;
        } catch {
          break;
        }
      }

      startTravel(fens, moves);
      // We don't overwrite hoverAdvice here so the LLM explanation stays visible
      setHoverEmotion("watching");
    } catch {
      setHoverAdvice("Failed to calculate a line.");
      setHoverEmotion("shocked");
    } finally {
      setLoading(false);
      driver.stop();
    }
  };

  return { activateTravel, loading };
}
