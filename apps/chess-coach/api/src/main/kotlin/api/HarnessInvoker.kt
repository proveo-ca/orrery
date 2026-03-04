package api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.util.Timer
import kotlin.concurrent.fixedRateTimer

@Serializable
data class HelloPhrases(val thinking: List<String>, val bestMove: List<String>)

class HarnessInvoker(private val harnessCommand: String = "./harness/bin/chess-coach-harness") {

    private val json = Json { ignoreUnknownKeys = true }

    @Volatile private var daemon: Process? = null
    @Volatile private var daemonReader: BufferedReader? = null
    @Volatile private var daemonWriter: OutputStreamWriter? = null
    @Volatile private var lastUsedAtMs: Long = 0L

    private val idleMs: Long = (System.getenv("HARNESS_IDLE_MS") ?: "60000").toLongOrNull() ?: 60_000L
    private val reaper: Timer = fixedRateTimer(name = "harness-daemon-reaper", daemon = true, initialDelay = 5_000L, period = 5_000L) {
        val p = daemon
        if (p != null) {
            val idleFor = System.currentTimeMillis() - lastUsedAtMs
            if (idleFor >= idleMs) {
                stopDaemon()
            }
        }
    }

    @Synchronized
    private fun ensureDaemonStarted() {
        val p = daemon
        if (p != null && p.isAlive) return

        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("daemon")
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()

        daemon = process
        daemonReader = process.inputStream.bufferedReader()
        daemonWriter = OutputStreamWriter(process.outputStream)
        lastUsedAtMs = System.currentTimeMillis()
    }

    @Synchronized
    private fun stopDaemon() {
        try {
            daemonWriter?.write("quit\n")
            daemonWriter?.flush()
        } catch (_: Exception) {
        }

        try {
            daemon?.destroy()
        } catch (_: Exception) {
        }

        daemon = null
        daemonReader = null
        daemonWriter = null
        lastUsedAtMs = 0L
    }

    suspend fun executeHello(): HelloPhrases = withContext(Dispatchers.IO) {
        ensureDaemonStarted()
        lastUsedAtMs = System.currentTimeMillis()

        val writer = daemonWriter ?: throw IllegalStateException("Harness daemon writer not available")
        val reader = daemonReader ?: throw IllegalStateException("Harness daemon reader not available")

        writer.write("hello\n")
        writer.flush()

        val line = reader.readLine() ?: throw IllegalStateException("Harness daemon returned no output")
        json.decodeFromString(HelloPhrases.serializer(), line)
    }
    
    suspend fun executeMove(move: String, fen: String): String = withContext(Dispatchers.IO) {
        println("Invoking harness for move: $move")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("move", move, fen)
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness execution finished with exit code: ${process.exitValue()}")
        
        // In a fully integrated setup, the harness would output a structured JSON 
        // or write the advice to a specific file. For now, we return the raw stdout.
        output.trim()
    }

    suspend fun executeAdvice(humanMove: String, aiMove: String, fen: String): String = withContext(Dispatchers.IO) {
        println("Invoking harness for advice")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("advice", humanMove, aiMove, fen)
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness advice execution finished with exit code: ${process.exitValue()}")
        output.trim()
    }

    suspend fun executeHint(): List<String> = withContext(Dispatchers.IO) {
        println("Invoking harness for hints")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("hint")
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness hint execution finished with exit code: ${process.exitValue()}")
        
        // Assuming the harness outputs hints separated by newlines
        output.lines().filter { it.isNotBlank() }
    }
}
