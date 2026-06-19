import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTravelMode } from "~/hooks/useTravelMode";
import { startTravel } from "~/store/travelStore";

vi.mock("~/services/api", () => ({
  postExplainStream: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/store", () => ({
  currentFen: vi.fn().mockReturnValue("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  setHoverAdvice: vi.fn(),
  setHoverEmotion: vi.fn(),
}));

vi.mock("~/engine/EnginePool", () => ({
  enginePool: {
    // Static best move; the second iteration's e7e5 is illegal (pawn already
    // moved), so the timeline-builder breaks after one continuation.
    evaluate: vi.fn().mockResolvedValue({ bestMove: "e7e5", score: null, depth: 12 }),
  },
}));

vi.mock("~/store/travelStore", () => ({
  startTravel: vi.fn(),
}));

describe("useTravelMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds incremental timeline from best moves (up to 8 or until end)", async () => {
    const { activateTravel } = useTravelMode();
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    await activateTravel(fen, "e4");

    // Initial lock + 1 continuation move (mock returns static bestmove; subsequent calls yield illegal uci and break)
    expect(startTravel).toHaveBeenCalledTimes(2);
    const finalCall = vi.mocked(startTravel).mock.calls[1];
    expect(finalCall[0]).toHaveLength(2);
    expect(finalCall[1]).toEqual([null, { from: "e7", to: "e5" }]);
  });
});
