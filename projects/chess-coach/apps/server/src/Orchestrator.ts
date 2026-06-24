import { buildPromptFromAnalysis, createMoveAnalysis, extractCommentary } from "@chess-coach/engine-core";

import { EngineConfig } from "./config.ts";
import type { IEngineBridge } from "./EngineBridge.ts";
import type { LlmClient } from "./LlmClient.ts";
import type { StateManager } from "./StateManager.ts";

export type TurnResult = { fen: string; move: string; advice: string };
export type UiPhrases = { thinking: string[]; bestMove: string[] };

const DEBUG_ENABLED = (process.env.LLM_DEBUG ?? "").trim().toLowerCase() === "true";

/**
 * In-process orchestrator. Faithful port of the Kotlin harness Orchestrator
 * (_spec/api/behavior.md §4), built on the shared @chess-coach/engine-core
 * prompt logic. There is no daemon / JSON-line layer — the HTTP handler calls
 * these methods directly.
 */
export class Orchestrator {
  constructor(
    private readonly stateManager: StateManager,
    private readonly engineBridge: IEngineBridge,
    private readonly llmClient: LlmClient,
  ) {}

  async executeTurn(humanMove: string, difficulty = "intermediate"): Promise<TurnResult> {
    console.error("--- Starting Turn ---");
    console.error(`Human played: ${humanMove === "" ? "(None - First Move)" : humanMove}`);

    const currentFen = this.stateManager.readFen();

    console.error("Evaluating position...");
    const evalResult = await this.engineBridge.getEvaluation(
      currentFen,
      EngineConfig.chess.defaultEvalDepth,
    );
    const evalString = evalResult.isMate
      ? `Mate in ${evalResult.mateIn}`
      : (evalResult.cp / 100).toFixed(2);
    console.error(`Stockfish Eval: Move: ${evalResult.bestMove}, Eval: ${evalString}`);

    console.error(`Asking Maia (${difficulty}) for move...`);
    const candidateMove = await this.engineBridge.getMaiaMove(currentFen, difficulty);
    console.error(`Maia Suggested Move: ${candidateMove}`);

    const newFen = await this.engineBridge.getFenAfterMove(currentFen, candidateMove);
    if (!newFen) throw new Error(`Maia generated an illegal move: ${candidateMove}`);

    console.error(`Move '${candidateMove}' is LEGAL.`);
    this.stateManager.writeFen(newFen);

    return { fen: newFen, move: candidateMove, advice: "" };
  }

  async *generateAdviceStream(
    humanMove: string,
    _aiMove: string,
    currentFen: string,
  ): AsyncGenerator<string, void, unknown> {
    const safeHumanMove = humanMove.trim() === "" ? "e4" : humanMove;

    const evalBefore = await this.engineBridge.getEvaluation(
      currentFen,
      EngineConfig.chess.defaultEvalDepth,
    );
    const fenAfterMove = await this.engineBridge.getFenAfterMove(currentFen, safeHumanMove);
    const evalAfter = fenAfterMove
      ? await this.engineBridge.getEvaluation(fenAfterMove, EngineConfig.chess.defaultEvalDepth)
      : evalBefore;

    const analysis = createMoveAnalysis({
      fenBefore: currentFen,
      fenAfter: fenAfterMove ?? currentFen,
      moveSan: safeHumanMove,
      evalBefore,
      evalAfter,
      actor: EngineConfig.llm.defaults.actor,
      gender: EngineConfig.llm.defaults.gender,
      mateScore: EngineConfig.chess.mateScoreForPrompt,
      name: EngineConfig.llm.defaults.name,
    });

    const prompt = buildPromptFromAnalysis(
      analysis,
      EngineConfig.llm.defaults.language,
      EngineConfig.llm.defaults.langCode,
      "standard",
    );

    let raw = "";
    for await (const chunk of this.llmClient.promptStream(
      EngineConfig.llm.systemPrompt,
      prompt,
      this.llmClient.commentaryModel,
      EngineConfig.llm.defaultTemperature,
      EngineConfig.llm.defaultMaxTokens,
    )) {
      raw += chunk;
    }

    const commentary = extractCommentary(raw);
    if (DEBUG_ENABLED) {
      console.error(`[LLM_DEBUG] kind=advice\nprompt:\n${prompt}\nraw:\n${raw}\nextracted:\n${commentary}`);
    }
    if (commentary.trim() !== "") yield commentary;
  }

  async *generateExplanationStream(
    fenBefore: string,
    fenAfter: string,
    isBlunder: boolean,
    moveSan: string,
  ): AsyncGenerator<string, void, unknown> {
    const evalBefore = await this.engineBridge.getEvaluation(
      fenBefore,
      EngineConfig.chess.defaultEvalDepth,
    );
    const evalAfter = await this.engineBridge.getEvaluation(
      fenAfter,
      EngineConfig.chess.defaultEvalDepth,
    );

    const analysis = createMoveAnalysis({
      fenBefore,
      fenAfter,
      moveSan,
      evalBefore,
      evalAfter,
      actor: EngineConfig.llm.defaults.actor,
      gender: EngineConfig.llm.defaults.gender,
      mateScore: EngineConfig.chess.mateScoreForPrompt,
      isForcedBlunder: isBlunder,
      name: EngineConfig.llm.defaults.name,
    });

    const prompt = buildPromptFromAnalysis(
      analysis,
      EngineConfig.llm.defaults.language,
      EngineConfig.llm.defaults.langCode,
      "explanation",
    );

    let raw = "";
    for await (const chunk of this.llmClient.promptStream(
      EngineConfig.llm.systemPrompt,
      prompt,
      this.llmClient.commentaryModel,
      EngineConfig.llm.explanationTemperature,
      EngineConfig.llm.explanationMaxTokens,
    )) {
      raw += chunk;
    }

    const commentary = extractCommentary(raw);
    if (DEBUG_ENABLED) {
      console.error(`[LLM_DEBUG] kind=explanation\nprompt:\n${prompt}\nraw:\n${raw}\nextracted:\n${commentary}`);
    }
    if (commentary.trim() !== "") yield commentary;
  }

  async generateUiPhrases(): Promise<UiPhrases> {
    try {
      console.error("Warming up LLM into VRAM...");
      await this.llmClient.prompt(
        "System",
        "Ping",
        this.llmClient.commentaryModel,
        EngineConfig.llm.defaultTemperature,
        1,
      );
      console.error("LLM Warmup complete.");
    } catch (e) {
      console.error(`LLM Warmup failed: ${(e as Error).message}`);
    }

    return {
      thinking: ["Hmm...", "Let me think...", "Interesting position...", "Rats...", "What to do..."],
      bestMove: ["Great move!", "Excellent!", "I like that.", "Strong play.", "Well done."],
    };
  }
}
