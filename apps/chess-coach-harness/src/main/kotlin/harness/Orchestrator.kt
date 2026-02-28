package harness

class Orchestrator(
    private val stateManager: StateManager,
    private val engineBridge: EngineBridge,
    private val llmClient: LlmClient
) {
    suspend fun executeTurn(humanMove: String): TurnResult {
        println("--- Starting Turn ---")
        println("Human played: $humanMove")
        
        // 1. Read Current State
        val currentFen = stateManager.readFen()
        val history = stateManager.readPgn()
        
        // 2. Get Board Evaluation
        println("Evaluating position...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = 15)
        println("Stockfish Eval: $evalResult")
        
        // 3. Reflexion Loop (Anti-Framework)
        var candidateMove = ""
        var isLegal = false
        var errorContext = ""
        var attempts = 0
        val maxAttempts = 3
        
        val systemPrompt = "You are an expert chess coach playing a game against a student. " +
                           "You must respond with ONLY the valid SAN (Standard Algebraic Notation) move for your turn. " +
                           "Do not include any other text, explanation, or markdown."

        while (!isLegal && attempts < maxAttempts) {
            attempts++
            println("LLM Prompt Attempt $attempts...")
            
            val userPrompt = buildString {
                appendLine("Current FEN: $currentFen")
                appendLine("Game History: $history")
                appendLine("Engine Evaluation: $evalResult")
                if (errorContext.isNotEmpty()) {
                    appendLine("CRITICAL ERROR FROM PREVIOUS ATTEMPT: $errorContext")
                }
                appendLine("What is your next move? Respond ONLY with the SAN move.")
            }
            
            candidateMove = llmClient.prompt(systemPrompt, userPrompt).trim()
            // Clean up potential markdown or extra spaces
            candidateMove = candidateMove.replace("`", "").trim()
            println("LLM Suggested Move: $candidateMove")
            
            // 4. Deterministic Handoff: Verify Candidate SAN
            isLegal = engineBridge.checkLegality(currentFen, candidateMove)
            
            if (!isLegal) {
                println("Move '$candidateMove' is ILLEGAL. Triggering reflexion...")
                errorContext = "You previously suggested '$candidateMove', but the chess engine rejected it as an ILLEGAL move. You must choose a different, strictly legal move."
            }
        }
        
        if (!isLegal) {
            throw IllegalStateException("LLM failed to generate a legal move after $maxAttempts attempts.")
        }
        
        println("Move '$candidateMove' is LEGAL.")
        
        // 5. Commit Valid Move
        // Note: In a full implementation, we would apply the SAN move to the FEN here.
        // For now, we just append to the PGN history.
        stateManager.appendMoveToPgn(candidateMove)
        
        // 6. Prompt: Generate Dialogue
        println("Generating coaching advice...")
        val adviceSystemPrompt = "You are an expert, encouraging chess coach. " +
                                 "Analyze the current state of the game, the student's last move ($humanMove), " +
                                 "and your response ($candidateMove). Keep it brief, constructive, and conversational."
                                 
        val adviceUserPrompt = "FEN: $currentFen\nEval: $evalResult\nProvide your coaching advice."
        
        val advice = llmClient.prompt(adviceSystemPrompt, adviceUserPrompt)
        println("Coach Advice: $advice")
        
        return TurnResult(
            fen = currentFen, // Would be updated FEN
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
