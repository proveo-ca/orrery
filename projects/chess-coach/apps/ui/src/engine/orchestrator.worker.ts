/// <reference lib="webworker" />
import { Orchestrator, type LlmDebugEvent } from "~/engine/Orchestrator";

const DEBUG = import.meta.env.VITE_DEBUG === "true";

const orchestrator = new Orchestrator((debugEvent: LlmDebugEvent) => {
  if (!DEBUG) return;
  self.postMessage({ type: "LLM_DEBUG", debug: debugEvent });
});

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case "NEW_GAME":
        self.postMessage({ id, result: { fen: orchestrator.resetGame() } });
        break;
      case "HELLO": {
        const phrases = await orchestrator.generateUiPhrases();
        self.postMessage({ id, result: { model: "web-llm", greeting: "Hey!", ...phrases } });
        break;
      }
      case "MOVE": {
        const result = await orchestrator.executeTurn(
          payload.humanMoveSan,
          payload.fenAfterHuman,
          payload.difficulty || "intermediate",
        );
        self.postMessage({ id, result });
        break;
      }
      case "ADVICE_STREAM":
        for await (const chunk of orchestrator.generateAdviceStream(
          payload.humanMove,
          payload.aiMove,
          payload.fen,
        )) {
          self.postMessage({ id, chunk });
        }
        self.postMessage({ id, done: true });
        break;
      case "EXPLAIN_STREAM":
        for await (const chunk of orchestrator.generateExplanationStream(
          payload.fenBefore,
          payload.fenAfter,
          payload.isBlunder,
          payload.moveSan,
        )) {
          self.postMessage({ id, chunk });
        }
        self.postMessage({ id, done: true });
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    self.postMessage({ id, error: error.message });
  }
});
