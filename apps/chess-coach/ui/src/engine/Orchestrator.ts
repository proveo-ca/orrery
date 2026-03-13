import { EngineBridge } from './EngineBridge';
import { LlmClient } from './LlmClient';

export type TurnResult = { fen: string; move: string; advice: string };
export type UiPhrases = { thinking: string[]; bestMove: string[] };

export class Orchestrator {
  private engineBridge = new EngineBridge();
  private llmClient = new LlmClient();
  private currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  resetGame(): string {
    this.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return this.currentFen;
  }

  async executeTurn(humanMoveSan: string, fenAfterHuman: string, difficulty: string): Promise<TurnResult> {
    console.log(`--- Starting Turn ---`);
    console.log(`Human played: ${humanMoveSan || '(None - First Move)'}`);
    
    this.currentFen = fenAfterHuman;

    console.log('Evaluating position...');
    const evalResult = await this.engineBridge.getEvaluation(this.currentFen, 15);
    const evalString = evalResult.isMate ? `Mate in ${evalResult.mateIn}` : (evalResult.cp / 100.0).toFixed(2);
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
      advice: ''
    };
  }

  async *generateAdviceStream(humanMove: string, _aiMove: string, currentFen: string): AsyncGenerator<string, void, unknown> {
    console.log('Generating coaching advice stream...');
    const evalResult = await this.engineBridge.getEvaluation(currentFen, 15);
    
    const parts = currentFen.split(' ');
    const activeColor = parts[1] || 'w';
    const aiColor = activeColor === 'w' ? 'Black' : 'White';
    const humanColor = aiColor === 'White' ? 'Black' : 'White';

    const adviceSystemPrompt = "Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification.";
    
    const cpString = evalResult.isMate ? `Mate in ${evalResult.mateIn}` : `${evalResult.cp}->${evalResult.cp} (Δ=0)`;
    const safeHumanMove = humanMove.trim() === '' ? 'e4' : humanMove;

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

    yield* this.llmClient.promptStream(adviceSystemPrompt, adviceUserPrompt, 0.7, 150);
  }

  async *generateExplanationStream(fenBefore: string, fenAfter: string, isBlunder: boolean, moveSan: string): AsyncGenerator<string, void, unknown> {
    console.log(`Generating explanation stream (isBlunder=${isBlunder}, move=${moveSan})...`);
    const evalBefore = await this.engineBridge.getEvaluation(fenBefore, 15);
    const evalAfter = await this.engineBridge.getEvaluation(fenAfter, 15);
    
    const partsAfter = fenAfter.split(' ');
    const activeColorAfter = partsAfter[1] || 'w';
    const moveColor = activeColorAfter === 'w' ? 'Black' : 'White';
    const opponentColor = activeColorAfter === 'w' ? 'White' : 'Black';

    const explainSystemPrompt = isBlunder
        ? `You are a chess expert. The player playing ${moveColor} just played ${moveSan}, which is a blunder. Explain in exactly ONE short sentence why ${moveSan} is a blunder. Do not provide any formatting, greetings, or extra text.`
        : `You are a chess expert. The player playing ${moveColor} just played ${moveSan}, which is an excellent move. Explain in exactly ONE short sentence why ${moveSan} is strong. Do not provide any formatting, greetings, or extra text.`;
    
    const cpBefore = evalBefore.isMate ? `Mate in ${evalBefore.mateIn}` : `${evalBefore.cp}`;
    const cpAfter = evalAfter.isMate ? `Mate in ${evalAfter.mateIn}` : `${evalAfter.cp}`;

    const explainUserPrompt = isBlunder
        ? `Before FEN: ${fenBefore}\nAfter FEN: ${fenAfter}\nBlunder played: ${moveSan} (by ${moveColor})\nEval Before: ${cpBefore}\nEval After: ${cpAfter}\nBest continuation for ${opponentColor}: ${evalAfter.pv}`
        : `Before FEN: ${fenBefore}\nAfter FEN: ${fenAfter}\nGreat move played: ${moveSan} (by ${moveColor})\nEval Before: ${cpBefore}\nEval After: ${cpAfter}\nBest continuation: ${evalAfter.pv}`;
    
    yield* this.llmClient.promptStream(explainSystemPrompt, explainUserPrompt, 0.7, 80);
  }

  async generateUiPhrases(): Promise<UiPhrases> {
    try {
      console.log("Warming up LLM into VRAM...");
      await this.llmClient.prompt("System", "Ping", 0.7, 1);
      console.log("LLM Warmup complete.");
    } catch (e: any) {
      console.error(`LLM Warmup failed: ${e.message}`);
    }

    return {
      thinking: ["Hmm...", "Let me think...", "Interesting position...", "Rats...", "What to do..."],
      bestMove: ["Great move!", "Excellent!", "I like that.", "Strong play.", "Well done."]
    };
  }
}
