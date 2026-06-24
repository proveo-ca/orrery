import { expect, test } from "bun:test";

import type { EvalResult, IEngineBridge } from "./EngineBridge.ts";
import type { LlmClient } from "./LlmClient.ts";
import { Orchestrator } from "./Orchestrator.ts";
import { StateManager } from "./StateManager.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

class FakeEngineBridge implements IEngineBridge {
  constructor(
    private readonly evals: Record<string, EvalResult>,
    private readonly transitions: Record<string, Record<string, string>>,
  ) {}
  async getEvaluation(fen: string): Promise<EvalResult> {
    const e = this.evals[fen];
    if (!e) throw new Error(`Missing fake evaluation for FEN: ${fen}`);
    return e;
  }
  async getFenAfterMove(fen: string, move: string): Promise<string | null> {
    return this.transitions[fen]?.[move] ?? null;
  }
  async getMaiaMove(): Promise<string> {
    return "e7e5";
  }
}

class RecordingLlmClient implements LlmClient {
  readonly commentaryModel = "test-model";
  lastSystemPrompt = "";
  lastUserPrompt = "";
  constructor(
    private readonly promptResponse: string,
    private readonly streamChunks: string[] = [],
  ) {}
  async prompt(systemPrompt: string, userPrompt: string): Promise<string> {
    this.lastSystemPrompt = systemPrompt;
    this.lastUserPrompt = userPrompt;
    return this.promptResponse;
  }
  async *promptStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string, void, unknown> {
    this.lastSystemPrompt = systemPrompt;
    this.lastUserPrompt = userPrompt;
    for (const c of this.streamChunks) yield c;
  }
}

const tmpState = () => new StateManager(`/tmp/cc-test-${Math.floor(performance.now())}-${process.pid}.fen`);

test("executeTurn returns the Maia move and resulting FEN", async () => {
  const bridge = new FakeEngineBridge(
    { [AFTER_E4_FEN]: { bestMove: "g1f3", cp: 20, isMate: false, mateIn: 0 } },
    { [AFTER_E4_FEN]: { e7e5: AFTER_E4_E5_FEN } },
  );
  const sm = tmpState();
  sm.writeFen(AFTER_E4_FEN);
  const orch = new Orchestrator(sm, bridge, new RecordingLlmClient(""));
  const result = await orch.executeTurn("e4", "intermediate");
  expect(result.move).toBe("e7e5");
  expect(result.fen).toBe(AFTER_E4_E5_FEN);
});

test("executeTurn throws on an illegal Maia move", async () => {
  const bridge = new FakeEngineBridge(
    { [AFTER_E4_FEN]: { bestMove: "g1f3", cp: 20, isMate: false, mateIn: 0 } },
    {}, // no transition => getFenAfterMove returns null => illegal
  );
  const sm = tmpState();
  sm.writeFen(AFTER_E4_FEN);
  const orch = new Orchestrator(sm, bridge, new RecordingLlmClient(""));
  await expect(orch.executeTurn("e4", "intermediate")).rejects.toThrow("illegal move");
});

test("generateAdviceStream emits commentary only with pre-move prompt semantics", async () => {
  const bridge = new FakeEngineBridge(
    {
      [START_FEN]: { bestMove: "g1f3", cp: 25, isMate: false, mateIn: 0 },
      [AFTER_E4_FEN]: { bestMove: "g8f6", cp: 18, isMate: false, mateIn: 0 },
    },
    { [START_FEN]: { e4: AFTER_E4_FEN } },
  );
  const llm = new RecordingLlmClient("", [
    "Commentary: Nice move ",
    "grabbing space in the center.\n",
    "Predicted ELO: 1700\n",
    "Verified Classification: Good Move\n",
  ]);
  const orch = new Orchestrator(tmpState(), bridge, llm);

  const emitted: string[] = [];
  for await (const c of orch.generateAdviceStream("e4", "", START_FEN)) emitted.push(c);

  expect(emitted).toEqual(["Nice move grabbing space in the center."]);
  expect(llm.lastUserPrompt).toContain("Type: standard");
  expect(llm.lastUserPrompt).toContain(`FEN: ${START_FEN}`);
  expect(llm.lastUserPrompt).toContain("MoveSAN: e4");
  expect(llm.lastUserPrompt).toContain("Side: White");
  expect(llm.lastUserPrompt).toContain("BestAlt: g1f3");
  expect(llm.lastUserPrompt).toContain("CP: 25->18 (Δ=7)");
  expect(llm.lastUserPrompt).not.toContain("Instruction:");
});

test("generateExplanationStream emits commentary only with explanation prompt + Instruction", async () => {
  const bridge = new FakeEngineBridge(
    {
      [START_FEN]: { bestMove: "g1f3", cp: 80, isMate: false, mateIn: 0 },
      [AFTER_E4_FEN]: { bestMove: "g8f6", cp: -40, isMate: false, mateIn: 0 },
    },
    {},
  );
  const llm = new RecordingLlmClient("", [
    "Commentary: e4 allows too much counterplay.\n",
    "Predicted ELO: 1500\n",
    "Verified Classification: Mistake\n",
  ]);
  const orch = new Orchestrator(tmpState(), bridge, llm);

  const emitted: string[] = [];
  for await (const c of orch.generateExplanationStream(START_FEN, AFTER_E4_FEN, false, "e4")) {
    emitted.push(c);
  }

  expect(emitted).toEqual(["e4 allows too much counterplay."]);
  expect(llm.lastUserPrompt).toContain("Type: explanation");
  expect(llm.lastUserPrompt).toContain("CP: 80->-40 (Δ=120)");
  expect(llm.lastUserPrompt).toContain("Instruction: Write the commentary in future tense.");
});

test("generateUiPhrases returns the canonical phrase lists", async () => {
  const orch = new Orchestrator(tmpState(), new FakeEngineBridge({}, {}), new RecordingLlmClient(""));
  const phrases = await orch.generateUiPhrases();
  expect(phrases.thinking).toEqual([
    "Hmm...",
    "Let me think...",
    "Interesting position...",
    "Rats...",
    "What to do...",
  ]);
  expect(phrases.bestMove).toEqual(["Great move!", "Excellent!", "I like that.", "Strong play.", "Well done."]);
});
