// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the engine pool so analyzeGameToCache resolves deterministically and we
// can count exactly which plies got (re-)analyzed.
const evaluate = vi.fn();
vi.mock("~/engine/EnginePool", () => ({
  enginePool: { evaluate: (...args: unknown[]) => evaluate(...args) },
}));

import { analyzeGameToCache } from "~/hooks/useGameAnalysis";
import type { GameRecord } from "~/store/gameHistoryStore";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const GID = "seed-prefix-test";
const KEY = `chess_coach_analysis_${GID}`;

// White is the player → player plies are the even indices (0, 2, 4, …).
const game = (moves: string[]): GameRecord => ({
  id: GID,
  startedAt: "",
  endedAt: null,
  result: "ongoing",
  pgn: "",
  startingFen: STARTING_FEN,
  playerColor: "w",
  difficulty: "intermediate",
  moves: moves.map((san, i) => ({ san, hasPressedHint: false, isAI: i % 2 === 1 })),
});

beforeEach(() => {
  localStorage.clear();
  evaluate.mockReset();
  evaluate.mockResolvedValue({ bestMove: "e2e4", score: { kind: "cp", value: 10 }, depth: 20 });
});

describe("analyzeGameToCache · warm-cache prefix reuse", () => {
  it("reuses a SHORTER pre-analysis cache by index and only analyzes the new tail", async () => {
    // Cache as written by live pre-analysis when the game had 4 moves:
    // player plies 0 and 2 already analyzed, arrays length 4.
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 5,
        cpDeltas: [-30, null, -20, null],
        wasBestMoves: [false, false, false, false],
        bestMoveUcis: ["e2e4", null, "d2d4", null],
        analyzed: [true, false, true, false],
        complete: false,
      }),
    );

    // Final game is 6 moves → one NEW player ply at index 4 (Nf3).
    await analyzeGameToCache(game(["e4", "e5", "d4", "d5", "Nf3", "Nc6"]), {
      signal: new AbortController().signal,
    });

    // Only ply 4 is fresh → best + played = 2 evals. (Under the old strict
    // length check the whole cache was dropped and all 3 player plies would
    // have been re-analyzed → 6 evals.)
    expect(evaluate).toHaveBeenCalledTimes(2);

    const cache = JSON.parse(localStorage.getItem(KEY)!);
    expect(cache.analyzed).toEqual([true, false, true, false, true, false]);
    // Reused prefix values are preserved at their original indices.
    expect(cache.cpDeltas[0]).toBe(-30);
    expect(cache.cpDeltas[2]).toBe(-20);
    expect(cache.bestMoveUcis[0]).toBe("e2e4");
    expect(cache.cpDeltas[4]).not.toBeNull();
  });

  it("analyzes every player ply when there is no cache", async () => {
    await analyzeGameToCache(game(["e4", "e5", "d4", "d5"]), {
      signal: new AbortController().signal,
    });
    // 2 player plies (0, 2) × (best + played) = 4 evals.
    expect(evaluate).toHaveBeenCalledTimes(4);
  });

  it("does NOT mark a ply analyzed when a search returns no score (retried later)", async () => {
    // Simulate the played eval coming back without a score (a degenerate
    // completion under live-play contention). The ply must stay unanalyzed.
    evaluate.mockImplementation((req: { searchMoves?: string[] }) =>
      Promise.resolve(
        req.searchMoves
          ? { bestMove: null, score: null, depth: 0 }
          : { bestMove: "e2e4", score: { kind: "cp", value: 10 }, depth: 20 },
      ),
    );

    await analyzeGameToCache(game(["e4", "e5"]), { signal: new AbortController().signal });

    const cache = JSON.parse(localStorage.getItem(KEY)!);
    // Ply 0 had no usable cp → not analyzed, no cp cached.
    expect(cache.analyzed[0]).toBe(false);
    expect(cache.cpDeltas[0]).toBeNull();
  });

  it("does no work when the cache already covers every player ply", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 5,
        cpDeltas: [-30, null, -20, null],
        wasBestMoves: [false, false, false, false],
        bestMoveUcis: ["e2e4", null, "d2d4", null],
        analyzed: [true, false, true, false],
        complete: true,
      }),
    );
    await analyzeGameToCache(game(["e4", "e5", "d4", "d5"]), {
      signal: new AbortController().signal,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });
});
