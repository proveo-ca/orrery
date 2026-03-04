package harness

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class DaemonRequest(
    val command: String,
    val difficulty: String = "intermediate",
    val humanMove: String = "",
    val aiMove: String = "",
    val fen: String = ""
)

@Serializable
data class DaemonResponse(
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
                                if (req.fen.isNotEmpty()) stateManager.writeFen(req.fen)
                                if (req.humanMove.isNotEmpty()) stateManager.appendMoveToPgn(req.humanMove)
                                val result = orchestrator.executeTurn(req.humanMove, req.difficulty)
                                DaemonResponse(move = result.move)
                            }
                            "advice" -> {
                                val advice = orchestrator.generateAdvice(req.humanMove, req.aiMove, req.fen)
                                DaemonResponse(advice = advice)
                            }
                            "hint" -> {
                                DaemonResponse(hints = listOf("e4 (+0.5)", "d4 (+0.4)"))
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
                val humanMove = args.getOrNull(1) ?: ""
                val humanFen = args.getOrNull(2) ?: ""
                val difficulty = args.getOrNull(3) ?: "intermediate"
                
                if (humanFen.isNotEmpty()) stateManager.writeFen(humanFen)
                if (humanMove.isNotEmpty()) stateManager.appendMoveToPgn(humanMove)

                val result = orchestrator.executeTurn(humanMove, difficulty)
                println(result.move)
            }
            "advice" -> {
                val humanMove = args.getOrNull(1) ?: ""
                val aiMove = args.getOrNull(2) ?: ""
                val currentFen = args.getOrNull(3) ?: stateManager.readFen()
                
                val advice = orchestrator.generateAdvice(humanMove, aiMove, currentFen)
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
