import { expect, test } from "bun:test";

import { createFetchHandler } from "./app.ts";
import type { EvalResult, IEngineBridge } from "./EngineBridge.ts";
import { Mutex } from "./http.ts";
import type { LlmClient } from "./LlmClient.ts";
import { Orchestrator } from "./Orchestrator.ts";
import { StateManager } from "./StateManager.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

class FakeBridge implements IEngineBridge {
  constructor(
    private readonly evals: Record<string, EvalResult>,
    private readonly transitions: Record<string, Record<string, string>>,
  ) {}
  async getEvaluation(fen: string): Promise<EvalResult> {
    return this.evals[fen] ?? { bestMove: "g1f3", cp: 0, isMate: false, mateIn: 0 };
  }
  async getFenAfterMove(fen: string, move: string): Promise<string | null> {
    return this.transitions[fen]?.[move] ?? null;
  }
  async getMaiaMove(): Promise<string> {
    return "e7e5";
  }
}

class StubLlm implements LlmClient {
  readonly commentaryModel = "test-model";
  constructor(private readonly chunks: string[]) {}
  async prompt(): Promise<string> {
    return this.chunks.join("");
  }
  async *promptStream(): AsyncGenerator<string, void, unknown> {
    for (const c of this.chunks) yield c;
  }
}

function makeHandler(bridge: IEngineBridge, llm: LlmClient) {
  const stateManager = new StateManager(`/tmp/cc-routes-${Math.floor(performance.now())}-${process.pid}.fen`);
  const orchestrator = new Orchestrator(stateManager, bridge, llm);
  return createFetchHandler({ orchestrator, stateManager, mutex: new Mutex() });
}

test("POST /move returns the AI reply and applies cross-origin isolation headers", async () => {
  const handler = makeHandler(
    new FakeBridge(
      { [AFTER_E4_FEN]: { bestMove: "g1f3", cp: 20, isMate: false, mateIn: 0 } },
      { [AFTER_E4_FEN]: { e7e5: AFTER_E4_E5_FEN } },
    ),
    new StubLlm([]),
  );
  const res = await handler(
    new Request("http://localhost/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanMoveSan: "e4", fenAfterHuman: AFTER_E4_FEN, difficulty: "intermediate" }),
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  expect(res.headers.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
  const body = (await res.json()) as { fen: string; move: string };
  expect(body.move).toBe("e7e5");
  expect(body.fen).toBe(AFTER_E4_E5_FEN);
});

test("POST /advice streams a single cleaned commentary chunk as text/plain", async () => {
  const handler = makeHandler(
    new FakeBridge(
      {
        [START_FEN]: { bestMove: "g1f3", cp: 25, isMate: false, mateIn: 0 },
        [AFTER_E4_FEN]: { bestMove: "g8f6", cp: 18, isMate: false, mateIn: 0 },
      },
      { [START_FEN]: { e4: AFTER_E4_FEN } },
    ),
    new StubLlm([
      "Commentary: Nice move ",
      "grabbing space in the center.\n",
      "Predicted ELO: 1700\n",
    ]),
  );
  const res = await handler(
    new Request("http://localhost/advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanMove: "e4", aiMove: "", fen: START_FEN }),
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toContain("text/plain");
  expect(await res.text()).toBe("Nice move grabbing space in the center.");
});

test("POST /new resets to the starting FEN", async () => {
  const handler = makeHandler(new FakeBridge({}, {}), new StubLlm([]));
  const res = await handler(new Request("http://localhost/new", { method: "POST" }));
  expect(res.status).toBe(200);
  expect((await res.json()) as { fen: string }).toEqual({ fen: START_FEN });
});

test("GET /hello returns model + greeting + phrase lists", async () => {
  const handler = makeHandler(new FakeBridge({}, {}), new StubLlm([]));
  const res = await handler(new Request("http://localhost/hello"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { greeting: string; thinking: string[]; bestMove: string[] };
  expect(body.greeting).toBe("Hey! I'm Selena. Let's play chess.");
  expect(body.thinking.length).toBe(5);
  expect(body.bestMove.length).toBe(5);
});

test("malformed JSON body maps to 400", async () => {
  const handler = makeHandler(new FakeBridge({}, {}), new StubLlm([]));
  const res = await handler(
    new Request("http://localhost/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    }),
  );
  expect(res.status).toBe(400);
});

test("unknown route returns 404", async () => {
  const handler = makeHandler(new FakeBridge({}, {}), new StubLlm([]));
  const res = await handler(new Request("http://localhost/nope", { method: "POST" }));
  expect(res.status).toBe(404);
});
