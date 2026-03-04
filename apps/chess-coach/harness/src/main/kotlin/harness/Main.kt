package harness

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Daemon request received over stdin (JSON-line protocol).
 *
 * For "move": [fenAfterHuman] is the position after the human move (applied client-side).
 *             [humanMoveSan] is the human's move in SAN (for history/logging only).
 * For "advice": [humanMoveSan], [aiMove], and [fenAfterHuman] describe the completed exchange.
 */
@Serializable
data class DaemonRequest(
    val command: String,
    val difficulty: String = "intermediate",
    val humanMoveSan: String = "",
    val aiMove: String = "",
    val fenAfterHuman: String = ""
)

@Serializable
data class DaemonResponse(
    val fen: String = "",
    val move: String = "",
    val advice: String = "",
    val hints: List<String> = emptyList(),
    val phrases: UiPhrases? = null
)

fun main(args: Array<String>) = runBlocking {
    if (args.isEmpty()) {
        System.err.println("Usage: harness <command> [arguments]")
        return@runBlocking
    }

    val command = args[0]
    val stateManager = StateManager()
    val engineBridge = EngineBridge()
    val llmClient = LlmClient()
    val orchestrator = Orchestrator(stateManager, engineBridge, llmClient)
    val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    try {
        engineBridge.start()

        when (command) {
            "daemon" -> {
                while (true) {
                    val line = readlnOrNull() ?: break
                    if (line.trim() == "quit") return@runBlocking
                    
                    try {
                        val req = json.decodeFromString<DaemonRequest>(line)
                        val res = when (req.command) {
                            "hello" -> {
                                DaemonResponse(phrases = orchestrator.generateUiPhrases())
                            }
                            "move" -> {
                                // fenAfterHuman is the position after the human move (applied client-side).
                                // humanMoveSan is for history/logging only; the harness does NOT re-apply it.
                                if (req.fenAfterHuman.isNotEmpty()) stateManager.writeFen(req.fenAfterHuman)
                                val result = orchestrator.executeTurn(req.humanMoveSan, req.difficulty)
                                DaemonResponse(fen = result.fen, move = result.move)
                            }
                            "advice" -> {
                                val advice = orchestrator.generateAdvice(req.humanMoveSan, req.aiMove, req.fenAfterHuman)
                                DaemonResponse(advice = advice)
                            }
                            else -> DaemonResponse()
                        }
                        println(json.encodeToString(res))
                        System.out.flush()
                    } catch (e: Exception) {
                        System.err.println("Daemon error: ${e.message}")
                        e.printStackTrace()
                        println("{}")
                        System.out.flush()
                    }
                }
            }
            "move" -> {
                // CLI: harness move <humanMoveSan> <fenAfterHuman> [difficulty]
                // fenAfterHuman is the position AFTER the human move (applied client-side).
                val humanMoveSan = args.getOrNull(1) ?: ""
                val fenAfterHuman = args.getOrNull(2) ?: ""
                val difficulty = args.getOrNull(3) ?: "intermediate"
                
                if (fenAfterHuman.isNotEmpty()) stateManager.writeFen(fenAfterHuman)

                val result = orchestrator.executeTurn(humanMoveSan, difficulty)
                // Output both fen and move so callers don't need to read state files
                println("${result.move} ${result.fen}")
            }
            "advice" -> {
                // CLI: harness advice <humanMoveSan> <aiMove> [fenAfterHuman]
                val humanMoveSan = args.getOrNull(1) ?: ""
                val aiMove = args.getOrNull(2) ?: ""
                val fenAfterHuman = args.getOrNull(3) ?: stateManager.readFen()
                
                val advice = orchestrator.generateAdvice(humanMoveSan, aiMove, fenAfterHuman)
                println(advice)
            }
            "hint" -> {
                println("e4 (+0.5)")
                println("d4 (+0.4)")
            }
            else -> System.err.println("Unknown command: $command")
        }
    } catch (e: Exception) {
        System.err.println("Fatal error in harness:")
        e.printStackTrace()
    } finally {
        engineBridge.stop()
        llmClient.close()
        if (command != "daemon") {
            kotlin.system.exitProcess(0)
        }
    }
}
