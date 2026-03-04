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
    suspend fun executeTurn(humanMove: String): TurnResult {
        System.err.println("--- Starting Turn ---")
        System.err.println("Human played: ${if (humanMove.isEmpty()) "(None - First Move)" else humanMove}")
        
        // 1. Read Current State
        val currentFen = stateManager.readFen()
        val history = stateManager.readPgn()
        
        // Determine colors based on whose turn it is in the FEN
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val aiColor = if (activeColor == "w") "White" else "Black"
        
        // 2. Get Board Evaluation
        System.err.println("Evaluating position...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        val evalString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else String.format("%.2f", evalResult.cp / 100.0)
        System.err.println("Stockfish Eval: Move: ${evalResult.bestMove}, Eval: $evalString")
        
        // 3. Reflexion Loop (Anti-Framework)
        var candidateMove = ""
        var isLegal = false
        var newFen = ""
        var errorContext = ""
        var attempts = 0
        val maxAttempts = 3
        
        val systemPrompt = "You are a chess engine playing $aiColor. " +
                           "You must respond with ONLY the valid 4-character or 5-character UCI notation move (e.g., e2e4, g1f3, e7e8q). " +
                           "NEVER use Standard Algebraic Notation (SAN) like 'e5' or 'Nf3'. " +
                           "Do not include any other text, explanation, or markdown."

        while (!isLegal && attempts < maxAttempts) {
            attempts++
            System.err.println("LLM Prompt Attempt $attempts...")
            
            val userPrompt = buildString {
                appendLine("Current FEN: $currentFen")
                appendLine("Game History: $history")
                appendLine("Engine Evaluation: Move: ${evalResult.bestMove}, Eval: $evalString")
                if (errorContext.isNotEmpty()) {
                    appendLine("CRITICAL ERROR FROM PREVIOUS ATTEMPT: $errorContext")
                }
                appendLine("What is your next move? Respond ONLY with the 4-character UCI move (e.g. e7e5).")
            }
            
            candidateMove = llmClient.prompt(systemPrompt, userPrompt, llmClient.defaultModel, temperature = 0.1).trim()
            // Clean up potential markdown or extra spaces
            candidateMove = candidateMove.replace("`", "").trim()
            System.err.println("LLM Suggested Move: $candidateMove")
            
            // 4. Deterministic Handoff: Verify Candidate SAN
            val resultingFen = engineBridge.getFenAfterMove(currentFen, candidateMove)
            
            if (resultingFen != null) {
                isLegal = true
                newFen = resultingFen
            } else {
                System.err.println("Move '$candidateMove' is ILLEGAL. Triggering reflexion...")
                errorContext = "You previously suggested '$candidateMove', but the chess engine rejected it. You MUST use 4-character UCI format like 'e7e5'."
            }
        }
        
        if (!isLegal) {
            throw IllegalStateException("LLM failed to generate a legal move after $maxAttempts attempts.")
        }
        
        System.err.println("Move '$candidateMove' is LEGAL.")
        
        // 5. Commit Valid Move
        stateManager.writeFen(newFen)
        stateManager.appendMoveToPgn(candidateMove)
        
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

        val adviceSystemPrompt = "Generate professional chess commentary in the specified language. For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification."
        
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
        
        val rawAdvice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt, llmClient.defaultModel, temperature = 0.7)
        System.err.println("Coach Advice generated.")
        
        // Extract just the commentary part if the model returns the full block
        val commentaryMatch = Regex("Commentary:\\s*(.*?)(?:\\n|Predicted ELO:|$)", RegexOption.DOT_MATCHES_ALL).find(rawAdvice)
        return commentaryMatch?.groupValues?.get(1)?.trim() ?: rawAdvice
    }

    suspend fun generateUiPhrases(): UiPhrases {
        val systemPrompt =
            "You are a JSON generator. Generate EXACTLY valid JSON with keys 'thinking' and 'bestMove'. " +
            "Each must be an array of exactly 5 short, distinct strings for a chess coach UI. " +
            "Example: {\"thinking\": [\"Hmm...\", \"Let me see...\", \"Interesting...\", \"Calculating...\", \"What to do...\"], \"bestMove\": [\"Great move!\", \"Excellent!\", \"Strong play.\", \"I like that.\", \"Well done.\"]}"
        val userPrompt = "Return the JSON now."

        val raw = llmClient.prompt(
            systemPrompt, 
            userPrompt, 
            llmClient.defaultModel, 
            temperature = 0.1, 
            format = "json"
        ).trim()
        
        val startIndex = raw.indexOf('{')
        val endIndex = raw.lastIndexOf('}')
        
        val cleaned = if (startIndex != -1 && endIndex != -1 && endIndex >= startIndex) {
            raw.substring(startIndex, endIndex + 1)
        } else {
            raw
        }

        return try {
            Json { ignoreUnknownKeys = true }.decodeFromString(UiPhrases.serializer(), cleaned)
        } catch (e: Exception) {
            System.err.println("Failed to parse UI phrases JSON. Raw output: $raw")
            UiPhrases(
                thinking = listOf("Hmm...", "Let me think...", "Interesting position...", "Calculating...", "What to do..."),
                bestMove = listOf("Great move!", "Excellent!", "I like that.", "Strong play.", "Well done.")
            )
        }
    }
}

data class TurnResult(
    val fen: String,
    val move: String,
    val advice: String
)
