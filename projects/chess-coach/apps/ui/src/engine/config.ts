export const ENGINE_CONFIG = {
  llm: {
    modelId: "chess-gemma-commentary-q4f32_1-MLC",
    wasmUrl: "gemma-3-270m-q4f32_1-webgpu.wasm",
    systemPrompt: "Generate professional chess commentary in the specified language. For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 150,
  },
  chess: {
    startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    defaultEvalDepth: 15,
  }
};
