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

vi.mock("~/engine/UciDriver", () => ({
  UciDriver: vi.fn(function (this: any) {
    this.send = vi.fn();
    this.readUntil = vi
      .fn()
      .mockResolvedValue(["info depth 12 pv e7e5 g1f3 b8c6", "bestmove e7e5 ponder g1f3"]);
    this.stop = vi.fn();
  }),
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
