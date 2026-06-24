// Server-side engine config. Mirrors the Kotlin harness EngineConfig
// (_spec/api/behavior.md §5.6). The canonical SYSTEM_PROMPT + behaviour
// constants come from @chess-coach/engine-core (shared with the browser);
// temperatures/token caps are the backend tuning (qwen-class model), an
// intentional per-platform divergence from the web build's gemma-270m tuning.
import { DEFAULT_EVAL_DEPTH, MATE_SCORE_FOR_PROMPT, SYSTEM_PROMPT } from "@chess-coach/engine-core";

export const EngineConfig = {
  llm: {
    systemPrompt: SYSTEM_PROMPT,
    defaultTemperature: 0.7,
    defaultMaxTokens: 256,
    explanationTemperature: 0.7,
    explanationMaxTokens: 256,
    defaults: {
      language: "English",
      langCode: "en",
      actor: "human" as const,
      gender: "neutral" as const,
      name: "",
    },
  },
  chess: {
    startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    defaultEvalDepth: DEFAULT_EVAL_DEPTH,
    mateScoreForPrompt: MATE_SCORE_FOR_PROMPT,
  },
} as const;
