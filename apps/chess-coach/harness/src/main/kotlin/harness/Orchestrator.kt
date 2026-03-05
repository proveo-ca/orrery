package harness

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class UiPhrases(val thinking: List<String>, val bestMove: List<String>)

class Orchestrator(
    private val stateManager: StateManager,
    private val engineBridge: EngineBridge,
    private val llmClient: LlmClient,
    private val skillLoader: SkillLoader = SkillLoader()
) {
    suspend fun executeTurn(humanMove: String, difficulty: String = "intermediate"): TurnResult {
        System.err.println("--- Starting Turn ---")
        System.err.println("Human played: ${if (humanMove.isEmpty()) "(None - First Move)" else humanMove}")
        
        // 1. Read Current State
        val currentFen = stateManager.readFen()
        
        // Determine colors based on whose turn it is in the FEN
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val aiColor = if (activeColor == "w") "White" else "Black"
        
        // 2. Get Board Evaluation
        System.err.println("Evaluating position...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        val evalString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else String.format("%.2f", evalResult.cp / 100.0)
        System.err.println("Stockfish Eval: Move: ${evalResult.bestMove}, Eval: $evalString")
        
        // 3. Get Move from Maia (lc0)
        System.err.println("Asking Maia ($difficulty) for move...")
        val candidateMove = engineBridge.getMaiaMove(currentFen, difficulty)
        System.err.println("Maia Suggested Move: $candidateMove")
        
        // 4. Verify Candidate SAN
        val newFen = engineBridge.getFenAfterMove(currentFen, candidateMove) 
            ?: throw IllegalStateException("Maia generated an illegal move: $candidateMove")
        
        System.err.println("Move '$candidateMove' is LEGAL.")
        
        // 5. Commit Valid Move
        stateManager.writeFen(newFen)
        
        return TurnResult(
            fen = newFen,
            move = candidateMove,
            advice = ""
        )
    }

    suspend fun generateAdvice(humanMove: String, aiMove: String, currentFen: String): String {
        System.err.println("Generating coaching advice...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val aiColor = if (activeColor == "w") "Black" else "White"
        val humanColor = if (aiColor == "White") "Black" else "White"

        val adviceSystemPrompt = "Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification."
        
        // We approximate the CP delta since we don't have the exact previous evaluation stored
        val cpString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else "${evalResult.cp}->${evalResult.cp} (Δ=0)"
        val safeHumanMove = if (humanMove.isBlank()) "e4" else humanMove

        val adviceUserPrompt = """LanguageL: English
LangCode: en
Type: standard
FEN: $currentFen
MoveSAN: $safeHumanMove
Side: $humanColor
Actor: human
Gender: neutral
Tag: Good
BestAlt: ${evalResult.bestMove}
CP: $cpString"""
        
        val rawAdvice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt, llmClient.commentaryModel, temperature = 0.7)
        System.err.println("Coach Advice generated.")
        
        // Extract just the commentary part if the model returns the full block
        val commentaryMatch = Regex("Commentary:\\s*(.*?)(?:\\n|Predicted ELO:|$)", RegexOption.DOT_MATCHES_ALL).find(rawAdvice)
        return commentaryMatch?.groupValues?.get(1)?.trim() ?: rawAdvice
    }

    suspend fun generateExplanation(currentFen: String): String {
        System.err.println("Generating blunder explanation...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val humanColor = if (activeColor == "w") "White" else "Black"

        val explainSystemPrompt = "You are a helpful chess coach. Explain briefly (under 40 words) why the last move resulting in this position is a blunder or mistake. Focus on the immediate tactical problem."
        
        val cpString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else "${evalResult.cp}"

        val explainUserPrompt = """FEN: $currentFen
Side to move: $humanColor
Best alternative: ${evalResult.bestMove}
Current Eval: $cpString"""
        
        val rawExplanation = llmClient.prompt(explainSystemPrompt, explainUserPrompt, llmClient.commentaryModel, temperature = 0.7)
        System.err.println("Explanation generated.")
        
        return rawExplanation.trim()
    }

    suspend fun generateUiPhrases(): UiPhrases {
        return UiPhrases(
            thinking = listOf("Hmm...", "Let me think...", "Interesting position...", "Rats...", "What to do..."),
            bestMove = listOf("Great move!", "Excellent!", "I like that.", "Strong play.", "Well done.")
        )
    }
}

data class TurnResult(
    val fen: String,
    val move: String,
    val advice: String
)
