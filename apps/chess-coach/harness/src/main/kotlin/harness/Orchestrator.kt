package harness

import kotlinx.coroutines.flow.Flow
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
        System.err.println("Generating coaching advice using ${llmClient.commentaryModel}...")
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
        
        val rawAdvice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt, llmClient.commentaryModel, temperature = 0.7, maxTokens = 150)
        System.err.println("Coach Advice generated.")
        
        // Extract just the commentary part if the model returns the full block
        val commentaryMatch = Regex("\\s*(.*?)(?:\\n|Predicted ELO:|$)", RegexOption.DOT_MATCHES_ALL).find(rawAdvice)
        return commentaryMatch?.groupValues?.get(1)?.trim() ?: rawAdvice
    }

    suspend fun generateAdviceStream(humanMove: String, aiMove: String, currentFen: String): Flow<String> {
        System.err.println("Generating coaching advice stream using ${llmClient.commentaryModel}...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val aiColor = if (activeColor == "w") "Black" else "White"
        val humanColor = if (aiColor == "White") "Black" else "White"

        val adviceSystemPrompt = "Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification."
        
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
        
        return llmClient.promptStream(adviceSystemPrompt, adviceUserPrompt, llmClient.commentaryModel, temperature = 0.7, maxTokens = 150)
    }

    suspend fun generateExplanation(fenBefore: String, fenAfter: String): String {
        System.err.println("Generating blunder explanation using ${llmClient.commentaryModel}...")
        val evalResult = engineBridge.getEvaluation(fenAfter, depth = 15)
        
        val activeColorAfter = fenAfter.split(" ").getOrNull(1) ?: "w"
        val blunderColor = if (activeColorAfter == "w") "Black" else "White"
        val punishingColor = if (activeColorAfter == "w") "White" else "Black"

        val explainSystemPrompt = "You are a chess expert. The player playing $blunderColor just made a move that changed the board from 'Before FEN' to 'After FEN'. This move is a blunder. Explain in exactly ONE short sentence why $blunderColor's move is a blunder. Do not provide any formatting, greetings, or extra text."
        
        val cpString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else "${evalResult.cp}"

        val explainUserPrompt = """Before FEN: $fenBefore
After FEN: $fenAfter
Blunder played by: $blunderColor
Best response for $punishingColor: ${evalResult.bestMove}
Current Eval (after blunder): $cpString"""
        
        val rawExplanation = llmClient.prompt(explainSystemPrompt, explainUserPrompt, llmClient.commentaryModel, temperature = 0.7, maxTokens = 60)
        System.err.println("Explanation generated.")
        
        return rawExplanation.trim()
    }

    suspend fun generateExplanationStream(fenBefore: String, fenAfter: String, isBlunder: Boolean, moveSan: String): Flow<String> {
        System.err.println("Generating explanation stream (isBlunder=$isBlunder, move=$moveSan) using ${llmClient.commentaryModel}...")
        val evalBefore = engineBridge.getEvaluation(fenBefore, depth = 15)
        val evalAfter = engineBridge.getEvaluation(fenAfter, depth = 15)
        
        val activeColorAfter = fenAfter.split(" ").getOrNull(1) ?: "w"
        val moveColor = if (activeColorAfter == "w") "Black" else "White"
        val opponentColor = if (activeColorAfter == "w") "White" else "Black"

        val explainSystemPrompt = if (isBlunder) {
            "You are a chess expert. The player playing $moveColor just played $moveSan, which is a blunder. Explain in exactly ONE short sentence why $moveSan is a blunder. Do not provide any formatting, greetings, or extra text."
        } else {
            "You are a chess expert. The player playing $moveColor just played $moveSan, which is an excellent move. Explain in exactly ONE short sentence why $moveSan is strong. Do not provide any formatting, greetings, or extra text."
        }
        
        val cpBefore = if (evalBefore.isMate) "Mate in ${evalBefore.mateIn}" else "${evalBefore.cp}"
        val cpAfter = if (evalAfter.isMate) "Mate in ${evalAfter.mateIn}" else "${evalAfter.cp}"

        val explainUserPrompt = if (isBlunder) {
            """Before FEN: $fenBefore
After FEN: $fenAfter
Blunder played: $moveSan (by $moveColor)
Eval Before: $cpBefore
Eval After: $cpAfter
Best response for $opponentColor: ${evalAfter.bestMove}"""
        } else {
            """Before FEN: $fenBefore
After FEN: $fenAfter
Great move played: $moveSan (by $moveColor)
Eval Before: $cpBefore
Eval After: $cpAfter"""
        }
        
        return llmClient.promptStream(explainSystemPrompt, explainUserPrompt, llmClient.commentaryModel, temperature = 0.7, maxTokens = 60)
    }

    suspend fun generateUiPhrases(): UiPhrases {
        // Warm up the model into VRAM on startup
        try {
            System.err.println("Warming up LLM into VRAM...")
            llmClient.prompt("System", "Ping", llmClient.commentaryModel, maxTokens = 1)
            System.err.println("LLM Warmup complete.")
        } catch (e: Exception) {
            System.err.println("LLM Warmup failed: ${e.message}")
        }

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
