package harness

class Orchestrator(
    private val stateManager: StateManager,
    private val engineBridge: EngineBridge,
    private val llmClient: LlmClient,
    private val skillLoader: SkillLoader = SkillLoader()
) {
    suspend fun executeTurn(humanMove: String): TurnResult {
        System.err.println("--- Starting Turn ---")
        System.err.println("Human played: $humanMove")
        
        // 1. Read Current State
        val currentFen = stateManager.readFen()
        val history = stateManager.readPgn()
        
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
        
        val systemPrompt = "You are an expert chess coach playing a game against a student. " +
                           "You must respond with ONLY the valid UCI notation move (e.g., e2e4, g1f3) for your turn. " +
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
                appendLine("What is your next move? Respond ONLY with the UCI move.")
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
                errorContext = "You previously suggested '$candidateMove', but the chess engine rejected it as an ILLEGAL move. You must choose a different, strictly legal UCI move."
            }
        }
        
        if (!isLegal) {
            throw IllegalStateException("LLM failed to generate a legal move after $maxAttempts attempts.")
        }
        
        System.err.println("Move '$candidateMove' is LEGAL.")
        
        // 5. Commit Valid Move
        stateManager.writeFen(newFen)
        stateManager.appendMoveToPgn(candidateMove)
        
        // 6. Prompt: Generate Dialogue
        System.err.println("Generating coaching advice...")
        
        // Load skills to inject into the prompt
        val skillsContext = skillLoader.loadAllSkills()
        
        val adviceSystemPrompt = "You are Selena, a cute black cat and an expert chess coach. " +
                                 "The human student is playing a game against YOU. " +
                                 "Analyze the current state of the game, the student's last move ($humanMove), " +
                                 "and your response ($candidateMove). " +
                                 "Give friendly, encouraging coaching advice. " +
                                 "Use the following chess knowledge to inform your advice if relevant:\n$skillsContext\n" +
                                 "CRITICAL: Your response MUST be under 256 characters."
                                 
        val adviceUserPrompt = "FEN: $newFen\nEval: $evalResult\nProvide your coaching advice."
        
        val advice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt, llmClient.defaultModel)
        System.err.println("Coach Advice generated.")
        
        return TurnResult(
            fen = newFen,
            move = candidateMove,
            advice = advice
        )
    }
}

data class TurnResult(
    val fen: String,
    val move: String,
    val advice: String
)
