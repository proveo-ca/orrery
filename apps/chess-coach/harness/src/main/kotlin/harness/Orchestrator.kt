package harness

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
        System.err.println("Stockfish Eval: $evalResult")
        
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
                appendLine("Engine Evaluation: $evalResult")
                if (errorContext.isNotEmpty()) {
                    appendLine("CRITICAL ERROR FROM PREVIOUS ATTEMPT: $errorContext")
                }
                appendLine("What is your next move? Respond ONLY with the 4-character UCI move (e.g. e7e5).")
            }
            
            candidateMove = llmClient.prompt(systemPrompt, userPrompt, llmClient.defaultModel).trim()
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
        val history = stateManager.readPgn()
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        
        val activeColor = currentFen.split(" ").getOrNull(1) ?: "w"
        val aiColor = if (activeColor == "w") "Black" else "White" // AI just played, so it's the opposite of active
        val humanColor = if (aiColor == "White") "Black" else "White"

        val skillsContext = skillLoader.loadAllSkills()
        
        val humanMoveContext = if (humanMove.isNotBlank()) {
            "The human student just played $humanMove, and you replied with $aiMove. " +
            "Focus your advice PRIMARILY on evaluating the human's move ($humanMove). " +
            "Was it a good idea? Did it leave anything undefended? " +
            "Don't mention your own move ($aiMove) unless it's a mate threat."
        } else {
            "You are making the first move of the game. Briefly explain your opening choice ($aiMove)."
        }
        
        val adviceSystemPrompt = "You are Selena, a cute black cat and an expert chess coach. " +
                                 "You are playing $aiColor, and the human student is playing $humanColor. " +
                                 "$humanMoveContext " +
                                 "Give friendly, encouraging coaching advice. " +
                                 "Use the following chess knowledge to inform your advice if relevant:\n$skillsContext\n" +
                                 "CRITICAL: Your response MUST be under 256 characters."
                                 
        val adviceUserPrompt = "Game History: $history\nCurrent FEN: $currentFen\nEval: $evalResult\nProvide your coaching advice."
        
        val advice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt, llmClient.defaultModel)
        System.err.println("Coach Advice generated.")
        return advice
    }
}

data class TurnResult(
    val fen: String,
    val move: String,
    val advice: String
)
