package harness

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

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
    val json = Json { prettyPrint = false }

    try {
        engineBridge.start()

        when (command) {
            "daemon" -> {
                while (true) {
                    val line = readlnOrNull() ?: break
                    when (line.trim()) {
                        "hello" -> {
                            val phrases = orchestrator.generateUiPhrases()
                            println(json.encodeToString(phrases))
                            System.out.flush()
                        }
                        "quit" -> return@runBlocking
                    }
                }
            }
            "move" -> {
                val humanMove = args.getOrNull(1) ?: ""
                val humanFen = args.getOrNull(2) ?: ""
                
                // Save the human's state before asking the LLM to play
                if (humanFen.isNotEmpty()) stateManager.writeFen(humanFen)
                if (humanMove.isNotEmpty()) stateManager.appendMoveToPgn(humanMove)

                val result = orchestrator.executeTurn(humanMove)
                
                // Print ONLY the move to stdout so the API can capture it cleanly
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
