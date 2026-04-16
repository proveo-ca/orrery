import { describe, expect, it } from "vitest";

import { resolveAnnotations } from "~/engine/moveAnnotations";
import type { MoveRecord } from "~/store/gameHistoryStore";

const human = (overrides: Partial<MoveRecord> = {}): MoveRecord => ({
  san: "e4",
  hasPressedHint: false,
  isAI: false,
  ...overrides,
});

const ai = (overrides: Partial<MoveRecord> = {}): MoveRecord => ({
  san: "e5",
  hasPressedHint: false,
  isAI: true,
  ...overrides,
});

describe("resolveAnnotations", () => {
  it("tags a best move with 'best'", () => {
    const tags = resolveAnnotations([human()], [5], [true]);
    expect(tags[0]).toEqual(["best"]);
  });

  it("tags a blunder (cpDelta <= -200) with 'blunder'", () => {
    const tags = resolveAnnotations([human()], [-350], [false]);
    expect(tags[0]).toEqual(["blunder"]);
  });

  it("adds 'hint' to a move the human followed from a hint", () => {
    const tags = resolveAnnotations([human({ hasPressedHint: true })], [10], [true]);
    expect(tags[0]).toEqual(["best", "hint"]);
  });

  it("AI moves get no tags even if cpDelta is bad", () => {
    const tags = resolveAnnotations([ai()], [-500], [false]);
    expect(tags[0]).toEqual([]);
  });

  it("forced: best + blunder marks current 'forced' and previous human as blunder", () => {
    const moves = [human({ san: "e4" }), ai({ san: "Qh4" }), human({ san: "g3" })];
    const cpDeltas = [0, null, -500];
    const wasBest = [true, false, true];
    const tags = resolveAnnotations(moves, cpDeltas, wasBest);
    expect(tags[2]).toEqual(["forced"]);
    expect(tags[0]).toEqual(["blunder"]);
    expect(tags[1]).toEqual([]);
  });

  it("forced: does NOT propagate blunder onto an AI move if there is no earlier human", () => {
    const moves = [ai({ san: "e4" }), human({ san: "e5" })];
    const tags = resolveAnnotations(moves, [null, -400], [false, true]);
    expect(tags[1]).toEqual(["forced"]);
    expect(tags[0]).toEqual([]);
  });

  it("no tags when cpDelta is null (analysis pending)", () => {
    const tags = resolveAnnotations([human()], [null], [true]);
    expect(tags[0]).toEqual([]);
  });

  it("tags an inaccuracy (cpDelta <= -50 and > -200, not best, bestMoveUci present)", () => {
    const tags = resolveAnnotations([human()], [-80], [false], ["e2e4"]);
    expect(tags[0]).toEqual(["inaccuracy"]);
  });

  it("does NOT tag inaccuracy when move was the best move", () => {
    const tags = resolveAnnotations([human()], [-80], [true], ["e2e4"]);
    expect(tags[0]).toEqual(["best"]);
  });

  it("does NOT tag inaccuracy when bestMoveUci is missing", () => {
    const tags = resolveAnnotations([human()], [-80], [false], [null]);
    expect(tags[0]).toEqual([]);
  });

  it("blunder takes precedence over inaccuracy", () => {
    const tags = resolveAnnotations([human()], [-250], [false], ["e2e4"]);
    expect(tags[0]).toEqual(["blunder"]);
  });
});
