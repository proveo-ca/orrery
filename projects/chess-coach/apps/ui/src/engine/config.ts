import { SYSTEM_PROMPT } from "@chess-coach/engine-core";

export const ENGINE_CONFIG = {
  llm: {
    modelId: "chess-gemma-commentary-q0f32-MLC",
    wasmUrl: "gemma-3-270m-q0f32-webgpu.wasm",
    systemPrompt: SYSTEM_PROMPT,
    defaultTemperature: 0.5,
    defaultMaxTokens: 128,
    explanationTemperature: 0.5,
    explanationMaxTokens: 80,
    defaults: {
      language: "English",
      langCode: "en",
      actor: "human",
      gender: "neutral",
      name: "",
    } as const,
  },
  chess: {
    startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    defaultEvalDepth: 15,
    mateScoreForPrompt: 9999,
  },
};
