import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MoveList } from "~/components/MoveList";
import type { GameRecord } from "~/store/gameHistoryStore";

beforeEach(() => {
  // jsdom polyfill for MoveList responsive pagination
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

// Fixture: Black player, PGN loaded via ReviewScreen would produce this GameRecord
const blackPlayerGame: GameRecord = {
  id: "black-player-game",
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  result: "win",
  pgn: "1. e4 e5 2. Nf3 Nf6",
  startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: "b",
  difficulty: "intermediate",
  moves: [
    { san: "e4", hasPressedHint: false, isAI: false },
    { san: "e5", hasPressedHint: false, isAI: false },
    { san: "Nf3", hasPressedHint: false, isAI: false },
    { san: "Nf6", hasPressedHint: false, isAI: false },
  ],
};

// Mock useGameAnalysis inside MoveList to return deterministic cp only on black plies
vi.mock("~/hooks/useGameAnalysis", () => ({
  useGameAnalysis: () => () => ({
    cpDeltas: [null, -12, null, 8],
    wasBestMoves: [false, false, false, false],
    bestMoveUcis: [null, null, null, null],
    loading: false,
  }),
}));

describe("MoveList after loading PGN in ReviewScreen (Black player)", () => {
  it("renders White/Black rows and shows cp only on the Black (player) side", async () => {
    // Simulate the state that ReviewScreen would pass to MoveList
    // after loading the PGN and fetching analysis.
    render(() => (
      <MoveList
        game={blackPlayerGame}
        analysis={{
          cpDeltas: [null, -12, null, 8],
          wasBestMoves: [false, false, false, false],
          bestMoveUcis: [null, null, null, null],
          loading: false,
        }}
      />
    ));

    const moveList = await screen.findByLabelText("Move list");

    // Chess order: White on left, Black on right
    const plys = moveList.querySelectorAll("[data-ply]");
    expect(plys.length).toBe(4);
    expect(plys[0].getAttribute("data-ply")).toBe("0"); // e4 (White)
    expect(plys[1].getAttribute("data-ply")).toBe("1"); // e5 (Black/player)
    expect(plys[2].getAttribute("data-ply")).toBe("2"); // Nf3 (White)
    expect(plys[3].getAttribute("data-ply")).toBe("3"); // Nf6 (Black/player)

    // cp only on player (Black) moves -> right column (ply 1 and 3)
    // Look for the formatted cp text directly
    expect(moveList.textContent).toContain("-12");
    expect(moveList.textContent).toContain("+8");

    // No cp text on opponent (White) plies containers
    const ply0 = moveList.querySelector("[data-ply='0']");
    const ply2 = moveList.querySelector("[data-ply='2']");
    expect(ply0?.textContent).not.toContain("-12");
    expect(ply0?.textContent).not.toContain("+8");
    expect(ply2?.textContent).not.toContain("-12");
    expect(ply2?.textContent).not.toContain("+8");
  });
});
