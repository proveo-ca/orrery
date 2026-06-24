import { expect, test } from "bun:test";

import {
  buildExplanationInstruction,
  buildPromptFromAnalysis,
  buildStructuredPrompt,
  classifyMoveTag,
  createMoveAnalysis,
  extractCommentary,
  formatCpTransition,
  scoreForPrompt,
  sideToMoveFromFen,
  SYSTEM_PROMPT,
} from "@chess-coach/engine-core";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Ported from apps/harness/.../LlmPromptFormatTest.kt — asserts against _spec/api/behavior.md.

test("buildStructuredPrompt uses exact model-card field order", () => {
  const prompt = buildStructuredPrompt({
    language: "English",
    langCode: "en",
    type: "standard",
    fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    moveSan: "Nf3",
    side: "White",
    actor: "human",
    name: "Selena",
    gender: "female",
    tag: "Good",
    bestAlt: "g1f3",
    cp: "27->21 (Δ=6)",
  });
  const lines = prompt.split("\n");
  expect(lines[0]).toBe("LanguageL: English");
  expect(lines[1]).toBe("LangCode: en");
  expect(lines[2]).toBe("Type: standard");
  expect(lines[3]).toBe("FEN: 8/8/8/8/8/8/8/8 w - - 0 1");
  expect(lines[4]).toBe("MoveSAN: Nf3");
  expect(lines[5]).toBe("Side: White");
  expect(lines[6]).toBe("Actor: human");
  expect(lines[7]).toBe("Name: Selena");
  expect(lines[8]).toBe("Gender: female");
  expect(lines[9]).toBe("Tag: Good");
  expect(lines[10]).toBe("BestAlt: g1f3");
  expect(lines[11]).toBe("CP: 27->21 (Δ=6)");
});

test("buildStructuredPrompt omits Name when blank", () => {
  const prompt = buildStructuredPrompt({
    language: "English",
    langCode: "en",
    type: "explanation",
    fen: "8/8/8/8/8/8/8/8 b - - 0 1",
    moveSan: "Nf6",
    side: "Black",
    actor: "human",
    name: "",
    gender: "neutral",
    tag: "Best",
    bestAlt: "g8f6",
    cp: "10->8 (Δ=2)",
  });
  expect(prompt).not.toContain("\nName:");
  expect(prompt).toContain("Gender: neutral");
});

test("buildStructuredPrompt requires non-empty required fields", () => {
  expect(() =>
    buildStructuredPrompt({
      language: "",
      langCode: "en",
      type: "standard",
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      moveSan: "e4",
      side: "White",
      actor: "human",
      gender: "neutral",
      tag: "Good",
      bestAlt: "e2e4",
      cp: "0->0 (Δ=0)",
    }),
  ).toThrow("Missing required prompt field: LanguageL");
});

test("formatCpTransition uses spec format", () => {
  expect(formatCpTransition(27, 21)).toBe("27->21 (Δ=6)");
  expect(formatCpTransition(120, 9999)).toBe("120->9999 (Δ=-9879)");
});

test("scoreForPrompt maps mate scores to configured sentinel values", () => {
  expect(scoreForPrompt({ cp: 0, isMate: true, mateIn: 3 }, 9999)).toBe(9999);
  expect(scoreForPrompt({ cp: 0, isMate: true, mateIn: -2 }, 9999)).toBe(-9999);
  expect(scoreForPrompt({ cp: 42, isMate: false, mateIn: 0 }, 9999)).toBe(42);
});

test("sideToMoveFromFen derives mover from pre-move fen", () => {
  expect(sideToMoveFromFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe("White");
  expect(sideToMoveFromFen("8/8/8/8/8/8/8/8 b - - 0 1")).toBe("Black");
});

test("classifyMoveTag uses expected thresholds", () => {
  expect(classifyMoveTag(20, 500, true)).toBe("Blunder");
  expect(classifyMoveTag(30, 40)).toBe("Best");
  expect(classifyMoveTag(30, 90)).toBe("Good");
  expect(classifyMoveTag(30, 170)).toBe("Inaccuracy");
  expect(classifyMoveTag(30, 260)).toBe("Mistake");
});

test("extractCommentary returns only commentary line from structured response", () => {
  const raw = [
    "Commentary: Strong move controlling the center.",
    "Predicted ELO: 1820",
    "Verified Classification: Good Move",
  ].join("\n");
  expect(extractCommentary(raw)).toBe("Strong move controlling the center.");
});

test("extractCommentary falls back to first non-empty non-metadata line", () => {
  const raw = [
    "Strong move controlling the center.",
    "Predicted ELO: 1820",
    "Verified Classification: Good Move",
  ].join("\n");
  expect(extractCommentary(raw)).toBe("Strong move controlling the center.");
});

// --- Convergence assertions (the gaps closed by engine-core, _spec/api/ui-engine-parity.md §3.1/§3.2) ---

test("SYSTEM_PROMPT includes the SAN sentence (§3.2)", () => {
  expect(SYSTEM_PROMPT).toContain("Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4).");
});

test("buildExplanationInstruction returns the tag-specific strings (§5.4)", () => {
  expect(buildExplanationInstruction("Blunder")).toContain("serious error that will allow tactical or positional punishment");
  expect(buildExplanationInstruction("Mistake")).toContain("less accurate or less efficient than the best alternative");
  expect(buildExplanationInstruction("Inaccuracy")).toContain("less accurate or less efficient than the best alternative");
  expect(buildExplanationInstruction("Good")).toContain("strong, useful, and beneficial");
});

test("buildPromptFromAnalysis appends the Instruction for explanation, not standard (§3.1)", () => {
  const analysis = createMoveAnalysis({
    fenBefore: START_FEN,
    fenAfter: START_FEN,
    moveSan: "e4",
    evalBefore: { cp: 40, isMate: false, mateIn: 0, bestMove: "g1f3" },
    evalAfter: { cp: 10, isMate: false, mateIn: 0, bestMove: "g8f6" },
    actor: "human",
    gender: "neutral",
    mateScore: 9999,
    name: "",
  });
  const explanation = buildPromptFromAnalysis(analysis, "English", "en", "explanation");
  const standard = buildPromptFromAnalysis(analysis, "English", "en", "standard");
  expect(explanation).toContain("Instruction: Write the commentary in future tense.");
  expect(standard).not.toContain("Instruction:");
});
