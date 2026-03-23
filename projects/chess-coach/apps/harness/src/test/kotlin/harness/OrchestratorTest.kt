package harness

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OrchestratorTest {
    @Test
    fun `generateAdvice uses pre-move prompt semantics and returns commentary only`() = runBlocking {
        val stateManager = StateManager()
        val engineBridge = FakeEngineBridge(
            evaluations = mapOf(
                START_FEN to EvalResult(bestMove = "g1f3", cp = 25, isMate = false, mateIn = 0, pv = ""),
                AFTER_E4_FEN to EvalResult(bestMove = "g8f6", cp = 18, isMate = false, mateIn = 0, pv = "")
            ),
            fenTransitions = mapOf(
                START_FEN to mapOf("e4" to AFTER_E4_FEN)
            )
        )
        val llmClient = RecordingLlmClient(
            promptResponse = """
                Commentary: Nice move controlling the center.
                Predicted ELO: 1750
                Verified Classification: Good Move
            """.trimIndent()
        )

        val orchestrator = TestOrchestrator(stateManager, engineBridge, llmClient)

        val result = orchestrator.generateAdvice("e4", "", START_FEN)

        assertEquals("Nice move controlling the center.", result)
        assertEquals(EngineConfig.Llm.SYSTEM_PROMPT, llmClient.lastSystemPrompt)
        assertTrue(llmClient.lastUserPrompt.contains("Type: standard"))
        assertTrue(llmClient.lastUserPrompt.contains("FEN: $START_FEN"))
        assertTrue(llmClient.lastUserPrompt.contains("MoveSAN: e4"))
        assertTrue(llmClient.lastUserPrompt.contains("Side: White"))
        assertTrue(llmClient.lastUserPrompt.contains("BestAlt: g1f3"))
        assertTrue(llmClient.lastUserPrompt.contains("CP: 25->18 (Δ=7)"))
    }

    @Test
    fun `generateExplanation uses actual moveSan and returns commentary only`() = runBlocking {
        val stateManager = StateManager()
        val engineBridge = FakeEngineBridge(
            evaluations = mapOf(
                START_FEN to EvalResult(bestMove = "g1f3", cp = 40, isMate = false, mateIn = 0, pv = ""),
                AFTER_E4_FEN to EvalResult(bestMove = "g8f6", cp = 10, isMate = false, mateIn = 0, pv = "")
            ),
            fenTransitions = emptyMap()
        )
        val llmClient = RecordingLlmClient(
            promptResponse = """
                Commentary: e4 weakens key squares and was less accurate than developing a knight.
                Predicted ELO: 1600
                Verified Classification: Inaccuracy
            """.trimIndent()
        )

        val orchestrator = TestOrchestrator(stateManager, engineBridge, llmClient)

        val result = orchestrator.generateExplanation(
            fenBefore = START_FEN,
            fenAfter = AFTER_E4_FEN,
            moveSan = "e4",
            isBlunder = false
        )

        assertEquals("e4 weakens key squares and was less accurate than developing a knight.", result)
        assertTrue(llmClient.lastUserPrompt.contains("Type: explanation"))
        assertTrue(llmClient.lastUserPrompt.contains("FEN: $START_FEN"))
        assertTrue(llmClient.lastUserPrompt.contains("MoveSAN: e4"))
        assertTrue(llmClient.lastUserPrompt.contains("Side: White"))
        assertTrue(llmClient.lastUserPrompt.contains("BestAlt: g1f3"))
        assertTrue(llmClient.lastUserPrompt.contains("CP: 40->10 (Δ=30)"))
    }

    @Test
    fun `generateAdviceStream emits commentary only`() = runBlocking {
        val stateManager = StateManager()
        val engineBridge = FakeEngineBridge(
            evaluations = mapOf(
                START_FEN to EvalResult(bestMove = "g1f3", cp = 12, isMate = false, mateIn = 0, pv = ""),
                AFTER_E4_FEN to EvalResult(bestMove = "g8f6", cp = 8, isMate = false, mateIn = 0, pv = "")
            ),
            fenTransitions = mapOf(
                START_FEN to mapOf("e4" to AFTER_E4_FEN)
            )
        )
        val llmClient = RecordingLlmClient(
            promptResponse = "",
            streamResponse = listOf(
                "Commentary: Nice move ",
                "grabbing space in the center.\n",
                "Predicted ELO: 1700\n",
                "Verified Classification: Good Move\n"
            )
        )

        val orchestrator = TestOrchestrator(stateManager, engineBridge, llmClient)

        val emitted = mutableListOf<String>()
        orchestrator.generateAdviceStream("e4", "", START_FEN).collect { emitted += it }

        assertEquals(listOf("Nice move grabbing space in the center."), emitted)
    }

    @Test
    fun `generateExplanationStream emits commentary only`() = runBlocking {
        val stateManager = StateManager()
        val engineBridge = FakeEngineBridge(
            evaluations = mapOf(
                START_FEN to EvalResult(bestMove = "g1f3", cp = 80, isMate = false, mateIn = 0, pv = ""),
                AFTER_E4_FEN to EvalResult(bestMove = "g8f6", cp = -40, isMate = false, mateIn = 0, pv = "")
            ),
            fenTransitions = emptyMap()
        )
        val llmClient = RecordingLlmClient(
            promptResponse = "",
            streamResponse = listOf(
                "Commentary: e4 allows too much counterplay.\n",
                "Predicted ELO: 1500\n",
                "Verified Classification: Mistake\n"
            )
        )

        val orchestrator = TestOrchestrator(stateManager, engineBridge, llmClient)

        val emitted = mutableListOf<String>()
        orchestrator.generateExplanationStream(START_FEN, AFTER_E4_FEN, isBlunder = false, moveSan = "e4")
            .collect { emitted += it }

        assertEquals(listOf("e4 allows too much counterplay."), emitted)
    }

    private companion object {
        const val START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        const val AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    }
}

private class TestOrchestrator(
    stateManager: StateManager,
    engineBridge: FakeEngineBridge,
    llmClient: RecordingLlmClient
) : Orchestrator(
    stateManager = stateManager,
    engineBridge = engineBridge,
    llmClient = llmClient
)

private class FakeEngineBridge(
    private val evaluations: Map<String, EvalResult>,
    private val fenTransitions: Map<String, Map<String, String>>
) : EngineBridge("stockfish") {
    override fun getEvaluation(fen: String, depth: Int): EvalResult {
        return evaluations[fen] ?: error("Missing fake evaluation for FEN: $fen")
    }

    override fun getFenAfterMove(fen: String, move: String): String? {
        return fenTransitions[fen]?.get(move)
    }

    override fun getMaiaMove(fen: String, difficulty: String): String {
        return "e7e5"
    }
}

private class RecordingLlmClient(
    private val promptResponse: String,
    private val streamResponse: List<String> = emptyList()
) : LlmClient("test-model") {
    var lastSystemPrompt: String = ""
    var lastUserPrompt: String = ""

    override suspend fun prompt(
        systemPrompt: String,
        userPrompt: String,
        model: String,
        temperature: Double,
        maxTokens: Int
    ): String {
        lastSystemPrompt = systemPrompt
        lastUserPrompt = userPrompt
        return promptResponse
    }

    override suspend fun promptStream(
        systemPrompt: String,
        userPrompt: String,
        model: String,
        temperature: Double,
        maxTokens: Int
    ): Flow<String> {
        lastSystemPrompt = systemPrompt
        lastUserPrompt = userPrompt
        return flow {
            streamResponse.forEach { emit(it) }
        }
    }
}
