import { Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type HoverEval, useHoverEvaluator } from "~/hooks/useHoverEvaluator";
import * as coachState from "~/store/coachStore";

import { renderHookTest } from "../utils/test-effect";

// Mock the store setters so we can spy on them
vi.mock("~/store/coachStore", () => ({
  setHoverAdvice: vi.fn(),
  setHoverEmotion: vi.fn(),
  setHoverBlunder: vi.fn(),
  setPendingTravel: vi.fn(),
}));

vi.mock("~/store/gameStore", () => ({
  currentFen: vi.fn(() => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
}));

describe("useHoverEvaluator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects a blunder when the evaluation drops by more than 200 centipawns", () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("e4");
    const [selected] = createSignal<Square>("e2");

    // FEN after White plays e2-e4
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "e2",
      to: "e4",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });

    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: "cp" as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [humanBestMove] = createSignal<string | null>("d2d4");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // Trigger the effect: AI (Black) evaluates the position as +250 for itself.
    // This means White's score dropped from +50 to -250 (a delta of -300 cp).
    setAnalysis({
      lastInfo: {
        score: { kind: "cp", value: 250 },
        pv: ["e7e5"], // Must be a valid move for Black in the eval FEN to pass the race-condition check
      },
    });

    expect(coachState.setHoverBlunder).toHaveBeenCalledWith(true, expect.any(String), "e4");
    expect(coachState.setHoverEmotion).toHaveBeenCalledWith("shocked");
    expect(coachState.setHoverAdvice).toHaveBeenCalledWith(expect.stringContaining("is a blunder"));
  });

  it("does not detect a blunder for a good move", () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("e4");
    const [selected] = createSignal<Square>("e2");
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "e2",
      to: "e4",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });

    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: "cp" as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [humanBestMove] = createSignal<string | null>("d2d4");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // Trigger the effect: AI (Black) evaluates the position as -60 for itself.
    // This means White's score improved from +50 to +60 (a delta of +10 cp).
    setAnalysis({
      lastInfo: {
        score: { kind: "cp", value: -60 },
        pv: ["e7e5"],
      },
    });

    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
    expect(coachState.setHoverEmotion).not.toHaveBeenCalled();
    expect(coachState.setHoverAdvice).not.toHaveBeenCalled();
  });

  it("detects a blunder when moving into a forced mate", () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("e4");
    const [selected] = createSignal<Square>("e2");
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "e2",
      to: "e4",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });

    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: "cp" as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [humanBestMove] = createSignal<string | null>("d2d4");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // AI (Black) has a forced mate in 2 (positive mate value means AI is winning)
    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: 2 },
        pv: ["e7e5"],
      },
    });

    // Human went from +50 to -10000 (getting mated). Definitely a blunder!
    expect(coachState.setHoverBlunder).toHaveBeenCalledWith(true, expect.any(String), "e4");
    expect(coachState.setHoverEmotion).toHaveBeenCalledWith("shocked");
  });

  it("does not detect a blunder when finding a forced mate", () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("e4");
    const [selected] = createSignal<Square>("e2");
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "e2",
      to: "e4",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });

    // Base score: White is slightly better (+50 cp)
    const [baseScore] = createSignal({ kind: "cp" as const, value: 50 });
    const [game] = createSignal(new Chess());
    const [humanBestMove] = createSignal<string | null>("d2d4");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // AI (Black) is getting mated in 2 (negative mate value means AI is losing)
    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: -2 },
        pv: ["e7e5"],
      },
    });

    // Human went from +50 to +10000 (delivering mate). Great move, not a blunder.
    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
  });

  it("does not detect a blunder if already getting mated and still getting mated", () => {
    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("e4");
    const [selected] = createSignal<Square>("e2");
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "e2",
      to: "e4",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });

    // Base score: White is already getting mated in 3 (negative mate value for White)
    const [baseScore] = createSignal({ kind: "mate" as const, value: -3 });
    const [game] = createSignal(new Chess());
    const [humanBestMove] = createSignal<string | null>("d2d4");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // AI (Black) still has a forced mate in 2
    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: 2 },
        pv: ["e7e5"],
      },
    });

    // Human went from -10000 to -10000. Delta is 0. Not a *new* blunder.
    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
  });

  it("does not notify when the threshold-crossing move IS the engine's best move", () => {
    // Forced position: White (human) is in check from a Black knight on e2
    // that royal-forks Kg1 and Qc1. The knight can't be captured, so every
    // legal move is a king move and White loses the queen to ...Nxc1 next.
    // Kf1 is the engine's best move yet the eval still craters — it must NOT
    // be reported as the player's mistake.
    const before = "4k3/7p/8/8/8/8/4n2P/2Q3K1 w - - 0 1";
    // After Kf1, with Black to move (its winning reply is the PV below).
    const afterKf1 = "4k3/7p/8/8/8/8/4n2P/2Q2K2 b - - 1 1";

    const [canApply] = createSignal(true);
    const [hovered] = createSignal<Square>("f1");
    const [selected] = createSignal<Square>("g1");
    const [hoverEval] = createSignal<HoverEval>({
      id: 1,
      from: "g1",
      to: "f1",
      fen: afterKf1,
    });

    // The base read hadn't yet seen the fork, so it looks roughly equal (+20).
    const [baseScore] = createSignal({ kind: "cp" as const, value: 20 });
    const [game] = createSignal(new Chess(before));
    const [humanBestMove] = createSignal<string | null>("g1f1");
    const [analysis, setAnalysis] = createSignal<any>({ lastInfo: null });

    renderHookTest({
      hook: useHoverEvaluator,
      props: {
        canApplyHoverOverride: canApply,
        hoveredSquare: hovered,
        selectedSquare: selected,
        currentHoverEval: hoverEval,
        analysis,
        baseEvalScore: baseScore,
        humanBestMove,
        game,
      },
    });

    // Deeper eval after Kf1: Black (to move) is up a queen (+900 for Black),
    // i.e. White dropped from +20 to ~-900 — well past the blunder threshold.
    // Black's winning reply Ne2xc1 must be legal in the eval FEN.
    setAnalysis({
      lastInfo: {
        score: { kind: "cp", value: 900 },
        pv: ["e2c1"],
      },
    });

    expect(coachState.setHoverBlunder).not.toHaveBeenCalled();
    expect(coachState.setHoverEmotion).not.toHaveBeenCalled();
    expect(coachState.setHoverAdvice).not.toHaveBeenCalled();
  });
});
