import { Chess, type Square } from "chess.js";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMoveExecutor } from "~/hooks/useMoveExecutor";
import * as coachState from "~/store/coachStore";

import { renderHookTest } from "../utils/test-effect";

// Mock the coach store setters
vi.mock("~/store/coachStore", () => ({
  setAdvice: vi.fn(),
  setCoachEmotion: vi.fn(),
}));

vi.mock("~/services/api", () => ({
  postMove: vi
    .fn()
    .mockResolvedValue({
      move: "e7e5",
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    }),
}));

vi.mock("~/store/gameStore", () => ({
  addMove: vi.fn(() => ({
    san: "e4",
    lan: "e2e4",
    after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  })),
  addMoveSan: vi.fn(() => ({ san: "e5" })),
  game: vi.fn(() => new Chess()),
  isThreefoldRepetition: vi.fn(() => false),
}));

vi.mock("~/store/capabilitiesStore", () => ({
  capabilities: vi.fn(() => ({ aiOpponent: true })),
}));

vi.mock("~/store/settingsStore", () => ({
  difficulty: vi.fn(() => "intermediate"),
}));

describe("useMoveExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects when the human has started a mating sequence", async () => {
    const stopStockfish = vi.fn();
    const [analysis, setAnalysis] = createSignal<any>({
      lastInfo: null,
    });

    let executor: ReturnType<typeof useMoveExecutor>;
    renderHookTest({
      hook: useMoveExecutor,
      props: stopStockfish,
      onResult: (result) => {
        executor = result;
      },
    });

    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: -3 },
      },
    });

    const game = new Chess();
    await executor!.executeMove({
      game,
      selected: "e2" as Square,
      square: "e4" as Square,
      analysis: () => analysis(),
    });

    expect(coachState.setCoachEmotion).toHaveBeenCalledWith("happy");
    expect(coachState.setAdvice).toHaveBeenCalledWith("You have begun a mating sequence!");
  });

  it("does not trigger mating sequence detection on non-mate scores", async () => {
    const stopStockfish = vi.fn();
    const [analysis, setAnalysis] = createSignal<any>({
      lastInfo: null,
    });

    let executor: ReturnType<typeof useMoveExecutor>;
    renderHookTest({
      hook: useMoveExecutor,
      props: stopStockfish,
      onResult: (result) => {
        executor = result;
      },
    });

    setAnalysis({
      lastInfo: {
        score: { kind: "cp", value: 150 },
      },
    });

    const game = new Chess();
    await executor!.executeMove({
      game,
      selected: "e2" as Square,
      square: "e4" as Square,
      analysis: () => analysis(),
    });

    expect(coachState.setCoachEmotion).not.toHaveBeenCalled();
    expect(coachState.setAdvice).not.toHaveBeenCalled();
  });

  it("detects when the human is under a mating sequence after AI move", async () => {
    const stopStockfish = vi.fn();
    const [analysis, setAnalysis] = createSignal<any>({
      lastInfo: null,
    });

    let executor: ReturnType<typeof useMoveExecutor>;
    renderHookTest({
      hook: useMoveExecutor,
      props: stopStockfish,
      onResult: (result) => {
        executor = result;
      },
    });

    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: -2 },
      },
    });

    const game = new Chess();
    await executor!.executeMove({
      game,
      selected: "e2" as Square,
      square: "e4" as Square,
      analysis: () => analysis(),
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(coachState.setCoachEmotion).toHaveBeenCalledWith("shocked");
    expect(coachState.setAdvice).toHaveBeenCalledWith("You're under a mating sequence!");
  });

  it("does not trigger shocked reaction on positive mate score after AI move", async () => {
    const stopStockfish = vi.fn();
    const [analysis, setAnalysis] = createSignal<any>({
      lastInfo: null,
    });

    let executor: ReturnType<typeof useMoveExecutor>;
    renderHookTest({
      hook: useMoveExecutor,
      props: stopStockfish,
      onResult: (result) => {
        executor = result;
      },
    });

    setAnalysis({
      lastInfo: {
        score: { kind: "mate", value: 3 },
      },
    });

    const game = new Chess();
    await executor!.executeMove({
      game,
      selected: "e2" as Square,
      square: "e4" as Square,
      analysis: () => analysis(),
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(coachState.setCoachEmotion).not.toHaveBeenCalledWith("shocked");
    expect(coachState.setAdvice).not.toHaveBeenCalledWith("You're under a mating sequence!");
  });
});
