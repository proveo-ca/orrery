import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MoveList } from "~/components/features/MoveList";
import type { GameRecord } from "~/types/game";

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

describe("MoveList annotation icons", () => {
  // Human plays White (plies 0,2,4,6); the AI replies on the odd plies, which
  // resolveAnnotations skips. The analysis is crafted so each annotation tag
  // backed by a CoachEmotionIcon appears exactly once:
  //   ply0 best (best move, small cp) · ply2 inaccuracy (mid cp, not best) ·
  //   ply4 blunder (large cp) · ply6 forced (best AND blunder).
  const annotatedGame: GameRecord = {
    id: "annotated-game",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    result: "win",
    pgn: "",
    startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playerColor: "w",
    difficulty: "intermediate",
    moves: [
      { san: "e4", hasPressedHint: false, isAI: false }, // 0 → best
      { san: "e5", hasPressedHint: false, isAI: true },
      { san: "Nf3", hasPressedHint: false, isAI: false }, // 2 → inaccuracy
      { san: "Nc6", hasPressedHint: false, isAI: true },
      { san: "Bb5", hasPressedHint: false, isAI: false }, // 4 → blunder
      { san: "a6", hasPressedHint: false, isAI: true },
      { san: "Bxc6", hasPressedHint: false, isAI: false }, // 6 → forced
      { san: "dxc6", hasPressedHint: false, isAI: true },
    ],
  };

  it("displays a CoachEmotionIcon for every emotion-backed annotation", () => {
    render(() => (
      <MoveList
        game={annotatedGame}
        analysis={{
          cpDeltas: [-10, null, -60, null, -300, null, -300, null],
          wasBestMoves: [true, false, false, false, false, false, true, false],
          bestMoveUcis: ["e2e4", null, "g1f3", null, null, null, "f1c6", null],
          loading: false,
        }}
      />
    ));

    // Every CoachEmotionIcon renders as <svg role="img"> with the emotion's
    // accessible label (best→happy, blunder→shocked, inaccuracy→thinking,
    // forced→shrug). getByRole throws if any is missing.
    for (const label of ["best move", "blunder", "inaccuracy", "forced"]) {
      expect(screen.getByRole("img", { name: label })).toBeTruthy();
    }
  });
});
