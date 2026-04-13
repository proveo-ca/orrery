import { ENGINE_CONFIG } from "~/engine/config";
import { EngineBridge } from "~/engine/EngineBridge";
import { fallbackAdvice, fallbackExplanation } from "~/engine/fallbackCommentary";
import type { LlmClient } from "~/engine/LlmClient";
import {
  buildPromptFromAnalysis,
  createMoveAnalysis,
  extractCommentary,
  type MoveAnalysis,
} from "~/engine/llmPromptFormat";
import { uciMatchesSan } from "~/engine/moveNotation";
import { sanitizeExplanationText, isLowQualityLlmOutput } from "~/engine/textSanitizer";

export type TurnResult = { fen: string; move: string; advice: string };
export type UiPhrases = { thinking: string[]; bestMove: string[] };

export type LlmDebugEvent = {
  type: "advice-fallback" | "explanation-fallback" | "explanation-debug";
  raw: string;
  prompt: string;
  finalText: string;
  analysis: MoveAnalysis;
  extractedCommentary?: string;
  usedFallback?: boolean;
  details?: {
    moveSan: string;
    tag: string;
    bestAlt: string;
    bestAltMatchesMove: boolean;
    fenBefore: string;
    fenAfter: string;
  };
};

const DEBUG_ENABLED = import.meta.env.VITE_DEBUG === "true";

export class Orchestrator {
  private engineBridge = new EngineBridge();
  private llmClient: LlmClient;
  private currentFen = ENGINE_CONFIG.chess.startingFen;
  private onDebug?: (event: LlmDebugEvent) => void;

  constructor(llmClient: LlmClient, onDebug?: (event: LlmDebugEvent) => void) {
    this.llmClient = llmClient;
    this.onDebug = onDebug;
  }

  resetGame(): string {
    this.currentFen = ENGINE_CONFIG.chess.startingFen;
    return this.currentFen;
  }

  async executeTurn(
    humanMoveSan: string,
    fenAfterHuman: string,
    difficulty: string,
  ): Promise<TurnResult> {
    console.log(`--- Starting Turn ---`);
    console.log(`Human played: ${humanMoveSan || "(None - First Move)"}`);

    this.currentFen = fenAfterHuman;

    console.log("Evaluating position...");
    const evalResult = await this.engineBridge.getEvaluation(
      this.currentFen,
      ENGINE_CONFIG.chess.defaultEvalDepth,
    );
    const evalString = evalResult.isMate
      ? `Mate in ${evalResult.mateIn}`
      : (evalResult.cp / 100.0).toFixed(2);
    console.log(`Stockfish Eval: Move: ${evalResult.bestMove}, Eval: ${evalString}`);

    console.log(`Asking AI (${difficulty}) for move...`);
    const candidateMove = await this.engineBridge.getAiMove(this.currentFen, difficulty);
    console.log(`AI Suggested Move: ${candidateMove}`);

    const newFen = await this.engineBridge.getFenAfterMove(this.currentFen, candidateMove);
    if (!newFen) {
      throw new Error(`AI generated an illegal move: ${candidateMove}`);
    }

    console.log(`Move '${candidateMove}' is LEGAL.`);
    this.currentFen = newFen;

    return {
      fen: newFen,
      move: candidateMove,
      advice: "",
    };
  }

  async *generateAdviceStream(
    humanMove: string,
    _aiMove: string,
    currentFen: string,
  ): AsyncGenerator<string, void, unknown> {
    console.log("Generating coaching advice stream...");
    const safeHumanMove = humanMove.trim() === "" ? "e4" : humanMove;

    const evalBefore = await this.engineBridge.getEvaluation(
      currentFen,
      ENGINE_CONFIG.chess.defaultEvalDepth,
    );
    const fenAfterMove = await this.engineBridge.getFenAfterMove(currentFen, safeHumanMove);
    const evalAfter = fenAfterMove
      ? await this.engineBridge.getEvaluation(fenAfterMove, ENGINE_CONFIG.chess.defaultEvalDepth)
      : evalBefore;

    const analysis = createMoveAnalysis({
      fenBefore: currentFen,
      fenAfter: fenAfterMove || currentFen,
      moveSan: safeHumanMove,
      evalBefore,
      evalAfter,
      actor: ENGINE_CONFIG.llm.defaults.actor,
      gender: ENGINE_CONFIG.llm.defaults.gender,
      mateScore: ENGINE_CONFIG.chess.mateScoreForPrompt,
      name: ENGINE_CONFIG.llm.defaults.name,
    });

    const prompt = buildPromptFromAnalysis(
      analysis,
      ENGINE_CONFIG.llm.defaults.language,
      ENGINE_CONFIG.llm.defaults.langCode,
      "standard",
    );

    let raw = "";

    for await (const chunk of this.llmClient.promptStream(
      ENGINE_CONFIG.llm.systemPrompt,
      prompt,
      ENGINE_CONFIG.llm.defaultTemperature,
      ENGINE_CONFIG.llm.defaultMaxTokens,
    )) {
      raw += chunk;
    }

    const extractedCommentary = extractCommentary(raw);
    let finalCommentary = sanitizeExplanationText(extractedCommentary);
    let usedFallback = false;

    if (isLowQualityLlmOutput(finalCommentary)) {
      finalCommentary = fallbackAdvice(safeHumanMove);
      usedFallback = true;
    }

    if (DEBUG_ENABLED) {
      this.onDebug?.({
        type: usedFallback ? "advice-fallback" : "explanation-debug",
        raw,
        prompt,
        finalText: finalCommentary,
        analysis,
        extractedCommentary,
        usedFallback,
        details: {
          moveSan: analysis.moveSan,
          tag: analysis.tag,
          bestAlt: analysis.bestAlt,
          bestAltMatchesMove: analysis.bestAltMatchesMove,
          fenBefore: analysis.fenBefore,
          fenAfter: analysis.fenAfter,
        },
      });
    }

    if (finalCommentary) {
      yield finalCommentary;
    }
  }

  async *generateExplanationStream(
    fenBefore: string,
    fenAfter: string,
    isBlunder: boolean,
    moveSan: string,
  ): AsyncGenerator<string, void, unknown> {
    console.log(`Generating explanation stream (isBlunder=${isBlunder}, move=${moveSan})...`);
    const evalBefore = await this.engineBridge.getEvaluation(
      fenBefore,
      ENGINE_CONFIG.chess.defaultEvalDepth,
    );
    const evalAfter = await this.engineBridge.getEvaluation(
      fenAfter,
      ENGINE_CONFIG.chess.defaultEvalDepth,
    );

    const bestAlt = evalBefore.bestMove || "";
    const bestAltMatchesMove = uciMatchesSan(fenBefore, bestAlt, moveSan);

    const analysis = createMoveAnalysis({
      fenBefore,
      fenAfter,
      moveSan,
      evalBefore,
      evalAfter,
      actor: ENGINE_CONFIG.llm.defaults.actor,
      gender: ENGINE_CONFIG.llm.defaults.gender,
      mateScore: ENGINE_CONFIG.chess.mateScoreForPrompt,
      isForcedBlunder: isBlunder,
      name: ENGINE_CONFIG.llm.defaults.name,
      bestAltMatchesMove,
    });

    const prompt = buildPromptFromAnalysis(
      analysis,
      ENGINE_CONFIG.llm.defaults.language,
      ENGINE_CONFIG.llm.defaults.langCode,
      "explanation",
    );

    const raw = await this.llmClient.prompt(
      ENGINE_CONFIG.llm.systemPrompt,
      prompt,
      ENGINE_CONFIG.llm.explanationTemperature,
      ENGINE_CONFIG.llm.explanationMaxTokens,
    );

    const extractedCommentary = extractCommentary(raw);
    let finalText = sanitizeExplanationText(extractedCommentary);
    let usedFallback = false;

    if (isLowQualityLlmOutput(finalText)) {
      finalText = fallbackExplanation(
        analysis.tag,
        analysis.bestAlt,
        analysis.bestAltMatchesMove,
      );
      usedFallback = true;
    }

    if (DEBUG_ENABLED) {
      this.onDebug?.({
        type: usedFallback ? "explanation-fallback" : "explanation-debug",
        raw,
        prompt,
        finalText,
        analysis,
        extractedCommentary,
        usedFallback,
        details: {
          moveSan: analysis.moveSan,
          tag: analysis.tag,
          bestAlt: analysis.bestAlt,
          bestAltMatchesMove: analysis.bestAltMatchesMove,
          fenBefore: analysis.fenBefore,
          fenAfter: analysis.fenAfter,
        },
      });
    }

    yield finalText;
  }

  async generateUiPhrases(): Promise<UiPhrases> {
    try {
      console.log("Warming up LLM into VRAM...");
      await this.llmClient.prompt("System", "Ping", ENGINE_CONFIG.llm.defaultTemperature, 1);
      console.log("LLM Warmup complete.");
    } catch (e: any) {
      console.error("LLM Warmup failed:", e);
    }

    return {
      thinking: [
        "Hmm...",
        "Let me think...",
        "Interesting position...",
        "Rats...",
        "What to do...",
      ],
      bestMove: ["Great move!", "Excellent!", "I like that.", "Strong play.", "Well done."],
    };
  }
}
