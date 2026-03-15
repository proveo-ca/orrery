import { EngineBridge } from "~/engine/EngineBridge";
import { LlmClient } from "~/engine/LlmClient";
import { ENGINE_CONFIG } from "~/engine/config";

export type TurnResult = { fen: string; move: string; advice: string };
export type UiPhrases = { thinking: string[]; bestMove: string[] };

export class Orchestrator {
  private engineBridge = new EngineBridge();
  private llmClient = new LlmClient();
  private currentFen = ENGINE_CONFIG.chess.startingFen;

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
    const evalResult = await this.engineBridge.getEvaluation(this.currentFen, ENGINE_CONFIG.chess.defaultEvalDepth);
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
    const evalResult = await this.engineBridge.getEvaluation(currentFen, ENGINE_CONFIG.chess.defaultEvalDepth);

    const parts = currentFen.split(" ");
    const activeColor = parts[1] || "w";
    const aiColor = activeColor === "w" ? "Black" : "White";
    const humanColor = aiColor === "White" ? "Black" : "White";

    const cpString = evalResult.isMate
      ? `Mate in ${evalResult.mateIn}`
      : `${evalResult.cp}->${evalResult.cp} (Δ=0)`;
    const safeHumanMove = humanMove.trim() === "" ? "e4" : humanMove;

    const adviceUserPrompt = `LanguageL: English
LangCode: en
Type: standard
FEN: ${currentFen}
MoveSAN: ${safeHumanMove}
Side: ${humanColor}
Actor: human
Gender: neutral
Tag: Good
BestAlt: ${evalResult.bestMove}
CP: ${cpString}`;

    yield* this.llmClient.promptStream(ENGINE_CONFIG.llm.systemPrompt, adviceUserPrompt, ENGINE_CONFIG.llm.defaultTemperature, ENGINE_CONFIG.llm.defaultMaxTokens);
  }

  async *generateExplanationStream(
    fenBefore: string,
    fenAfter: string,
    isBlunder: boolean,
    moveSan: string,
  ): AsyncGenerator<string, void, unknown> {
    console.log(`Generating explanation stream (isBlunder=${isBlunder}, move=${moveSan})...`);
    const evalBefore = await this.engineBridge.getEvaluation(fenBefore, ENGINE_CONFIG.chess.defaultEvalDepth);
    const evalAfter = await this.engineBridge.getEvaluation(fenAfter, ENGINE_CONFIG.chess.defaultEvalDepth);

    const partsAfter = fenAfter.split(" ");
    const activeColorAfter = partsAfter[1] || "w";
    const moveColor = activeColorAfter === "w" ? "Black" : "White";

    // Calculate CP Delta for the prompt
    const cpB = evalBefore.isMate ? (evalBefore.mateIn! > 0 ? 9999 : -9999) : evalBefore.cp;
    const cpA = evalAfter.isMate ? (evalAfter.mateIn! > 0 ? 9999 : -9999) : evalAfter.cp;
    const delta = Math.abs(cpA - cpB);
    
    const cpString = evalBefore.isMate || evalAfter.isMate 
      ? `Mate` 
      : `${cpB}->${cpA} (Δ=${delta})`;

    let tag = "Good";
    if (isBlunder) tag = "Blunder";
    else if (delta > 200) tag = "Mistake";
    else if (delta > 100) tag = "Inaccuracy";
    else if (delta < 20) tag = "Best";

    const explainUserPrompt = `LanguageL: English
LangCode: en
Type: explanation
FEN: ${fenBefore}
MoveSAN: ${moveSan}
Side: ${moveColor}
Actor: human
Gender: neutral
Tag: ${tag}
BestAlt: ${evalBefore.bestMove}
CP: ${cpString}`;

    yield* this.llmClient.promptStream(ENGINE_CONFIG.llm.systemPrompt, explainUserPrompt, ENGINE_CONFIG.llm.defaultTemperature, ENGINE_CONFIG.llm.defaultMaxTokens);
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
