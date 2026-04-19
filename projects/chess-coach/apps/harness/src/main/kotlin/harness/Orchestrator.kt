// SPEC: _spec/chess-coach/harness/components.puml
// SPEC: _spec/chess-coach/harness/lifecycle.puml
package harness

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.Serializable

@Serializable
data class UiPhrases(val thinking: List<String>, val bestMove: List<String>)

class Orchestrator(
    private val stateManager: StateManager,
    private val engineBridge: EngineBridge,
    private val llmClient: LlmClient,
    private val skillLoader: SkillLoader = SkillLoader()
) {
    private val debugEnabled: Boolean =
        System.getenv("LLM_DEBUG")?.trim()?.equals("true", ignoreCase = true) == true

    suspend fun executeTurn(humanMove: String, difficulty: String = "intermediate"): TurnResult {
        System.err.println("--- Starting Turn ---")
        System.err.println("Human played: ${if (humanMove.isEmpty()) "(None - First Move)" else humanMove}")
        
        val currentFen = stateManager.readFen()
        
        System.err.println("Evaluating position...")
        val evalResult = engineBridge.getEvaluation(currentFen, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        val evalString = if (evalResult.isMate) "Mate in ${evalResult.mateIn}" else String.format("%.2f", evalResult.cp / 100.0)
        System.err.println("Stockfish Eval: Move: ${evalResult.bestMove}, Eval: $evalString")
        
        System.err.println("Asking Maia ($difficulty) for move...")
        val candidateMove = engineBridge.getMaiaMove(currentFen, difficulty)
        System.err.println("Maia Suggested Move: $candidateMove")
        
        val newFen = engineBridge.getFenAfterMove(currentFen, candidateMove) 
            ?: throw IllegalStateException("Maia generated an illegal move: $candidateMove")
        
        System.err.println("Move '$candidateMove' is LEGAL.")
        
        stateManager.writeFen(newFen)
        
        return TurnResult(
            fen = newFen,
            move = candidateMove,
            advice = ""
        )
    }

    suspend fun generateAdvice(humanMove: String, aiMove: String, currentFen: String): String {
        System.err.println("Generating coaching advice using ${llmClient.commentaryModel}...")
        val safeHumanMove = if (humanMove.isBlank()) "e4" else humanMove
        val evalBefore = engineBridge.getEvaluation(currentFen, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        val fenAfterMove = engineBridge.getFenAfterMove(currentFen, safeHumanMove)
        val evalAfter = if (fenAfterMove != null) {
            engineBridge.getEvaluation(fenAfterMove, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        } else {
            evalBefore
        }

        val analysis = createMoveAnalysis(
            fenBefore = currentFen,
            fenAfter = fenAfterMove ?: currentFen,
            moveSan = safeHumanMove,
            evalBefore = evalBefore,
            evalAfter = evalAfter,
            actor = EngineConfig.Llm.DEFAULT_ACTOR,
            gender = EngineConfig.Llm.DEFAULT_GENDER,
            mateScore = EngineConfig.Chess.MATE_SCORE_FOR_PROMPT,
            name = EngineConfig.Llm.DEFAULT_NAME
        )

        val adviceUserPrompt = buildPromptFromAnalysis(
            analysis = analysis,
            language = EngineConfig.Llm.DEFAULT_LANGUAGE,
            langCode = EngineConfig.Llm.DEFAULT_LANG_CODE,
            type = "standard"
        )
        
        val rawAdvice = llmClient.prompt(
            EngineConfig.Llm.SYSTEM_PROMPT,
            adviceUserPrompt,
            llmClient.commentaryModel,
            temperature = EngineConfig.Llm.DEFAULT_TEMPERATURE,
            maxTokens = EngineConfig.Llm.DEFAULT_MAX_TOKENS
        )
        System.err.println("Coach Advice generated.")

        val extractedCommentary = extractCommentary(rawAdvice)

        if (debugEnabled) {
            System.err.println(
                """
                |[LLM_DEBUG] kind=advice
                |prompt:
                |$adviceUserPrompt
                |analysis:
                |  moveSan=${analysis.moveSan}
                |  tag=${analysis.tag}
                |  bestAlt=${analysis.bestAlt}
                |  fenBefore=${analysis.fenBefore}
                |  fenAfter=${analysis.fenAfter}
                |raw:
                |$rawAdvice
                |extracted:
                |$extractedCommentary
                |final:
                |$extractedCommentary
                """.trimMargin()
            )
        }
        
        return extractedCommentary
    }

    suspend fun generateAdviceStream(humanMove: String, aiMove: String, currentFen: String): Flow<String> {
        System.err.println("Generating coaching advice stream using ${llmClient.commentaryModel}...")
        val safeHumanMove = if (humanMove.isBlank()) "e4" else humanMove
        val evalBefore = engineBridge.getEvaluation(currentFen, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        val fenAfterMove = engineBridge.getFenAfterMove(currentFen, safeHumanMove)
        val evalAfter = if (fenAfterMove != null) {
            engineBridge.getEvaluation(fenAfterMove, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        } else {
            evalBefore
        }

        val analysis = createMoveAnalysis(
            fenBefore = currentFen,
            fenAfter = fenAfterMove ?: currentFen,
            moveSan = safeHumanMove,
            evalBefore = evalBefore,
            evalAfter = evalAfter,
            actor = EngineConfig.Llm.DEFAULT_ACTOR,
            gender = EngineConfig.Llm.DEFAULT_GENDER,
            mateScore = EngineConfig.Chess.MATE_SCORE_FOR_PROMPT,
            name = EngineConfig.Llm.DEFAULT_NAME
        )

        val adviceUserPrompt = buildPromptFromAnalysis(
            analysis = analysis,
            language = EngineConfig.Llm.DEFAULT_LANGUAGE,
            langCode = EngineConfig.Llm.DEFAULT_LANG_CODE,
            type = "standard"
        )
        
        return collectCommentaryFlow(
            llmClient.promptStream(
                EngineConfig.Llm.SYSTEM_PROMPT,
                adviceUserPrompt,
                llmClient.commentaryModel,
                temperature = EngineConfig.Llm.DEFAULT_TEMPERATURE,
                maxTokens = EngineConfig.Llm.DEFAULT_MAX_TOKENS
            )
        )
    }

    suspend fun generateExplanation(
        fenBefore: String,
        fenAfter: String,
        moveSan: String,
        isBlunder: Boolean = true
    ): String {
        System.err.println("Generating explanation using ${llmClient.commentaryModel}...")
        val evalBefore = engineBridge.getEvaluation(fenBefore, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        val evalAfter = engineBridge.getEvaluation(fenAfter, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)

        val analysis = createMoveAnalysis(
            fenBefore = fenBefore,
            fenAfter = fenAfter,
            moveSan = moveSan,
            evalBefore = evalBefore,
            evalAfter = evalAfter,
            actor = EngineConfig.Llm.DEFAULT_ACTOR,
            gender = EngineConfig.Llm.DEFAULT_GENDER,
            mateScore = EngineConfig.Chess.MATE_SCORE_FOR_PROMPT,
            isForcedBlunder = isBlunder,
            name = EngineConfig.Llm.DEFAULT_NAME
        )

        val explainUserPrompt = buildPromptFromAnalysis(
            analysis = analysis,
            language = EngineConfig.Llm.DEFAULT_LANGUAGE,
            langCode = EngineConfig.Llm.DEFAULT_LANG_CODE,
            type = "explanation"
        )
        
        val rawExplanation = llmClient.prompt(
            EngineConfig.Llm.SYSTEM_PROMPT,
            explainUserPrompt,
            llmClient.commentaryModel,
            temperature = EngineConfig.Llm.EXPLANATION_TEMPERATURE,
            maxTokens = EngineConfig.Llm.EXPLANATION_MAX_TOKENS
        )
        System.err.println("Explanation generated.")

        val extractedCommentary = extractCommentary(rawExplanation)

        if (debugEnabled) {
            System.err.println(
                """
                |[LLM_DEBUG] kind=explanation
                |prompt:
                |$explainUserPrompt
                |analysis:
                |  moveSan=${analysis.moveSan}
                |  tag=${analysis.tag}
                |  bestAlt=${analysis.bestAlt}
                |  fenBefore=${analysis.fenBefore}
                |  fenAfter=${analysis.fenAfter}
                |raw:
                |$rawExplanation
                |extracted:
                |$extractedCommentary
                |final:
                |$extractedCommentary
                """.trimMargin()
            )
        }
        
        return extractedCommentary
    }

    suspend fun generateExplanationStream(fenBefore: String, fenAfter: String, isBlunder: Boolean, moveSan: String): Flow<String> {
        System.err.println("Generating explanation stream (isBlunder=$isBlunder, move=$moveSan) using ${llmClient.commentaryModel}...")
        val evalBefore = engineBridge.getEvaluation(fenBefore, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)
        val evalAfter = engineBridge.getEvaluation(fenAfter, depth = EngineConfig.Chess.DEFAULT_EVAL_DEPTH)

        val analysis = createMoveAnalysis(
            fenBefore = fenBefore,
            fenAfter = fenAfter,
            moveSan = moveSan,
            evalBefore = evalBefore,
            evalAfter = evalAfter,
            actor = EngineConfig.Llm.DEFAULT_ACTOR,
            gender = EngineConfig.Llm.DEFAULT_GENDER,
            mateScore = EngineConfig.Chess.MATE_SCORE_FOR_PROMPT,
            isForcedBlunder = isBlunder,
            name = EngineConfig.Llm.DEFAULT_NAME
        )

        val explainUserPrompt = buildPromptFromAnalysis(
            analysis = analysis,
            language = EngineConfig.Llm.DEFAULT_LANGUAGE,
            langCode = EngineConfig.Llm.DEFAULT_LANG_CODE,
            type = "explanation"
        )
        
        return collectCommentaryFlow(
            llmClient.promptStream(
                EngineConfig.Llm.SYSTEM_PROMPT,
                explainUserPrompt,
                llmClient.commentaryModel,
                temperature = EngineConfig.Llm.EXPLANATION_TEMPERATURE,
                maxTokens = EngineConfig.Llm.EXPLANATION_MAX_TOKENS
            )
        )
    }

    private suspend fun collectCommentaryFlow(source: Flow<String>): Flow<String> = flow {
        val buffer = StringBuilder()
        source.collect { chunk ->
            buffer.append(chunk)
        }
        val commentary = extractCommentary(buffer.toString())
        if (commentary.isNotBlank()) {
            emit(commentary)
        }
    }

    suspend fun generateUiPhrases(): UiPhrases {
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
