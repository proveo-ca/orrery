package api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.util.Timer
import kotlin.concurrent.fixedRateTimer

@Serializable
data class HelloPhrases(val thinking: List<String>, val bestMove: List<String>)

@Serializable
data class DaemonRequest(
    val command: String,
    val difficulty: String = "beginner",
    val humanMove: String = "",
    val aiMove: String = "",
    val fen: String = ""
)

@Serializable
data class DaemonResponse(
    val move: String = "",
    val advice: String = "",
    val hints: List<String> = emptyList(),
    val phrases: HelloPhrases? = null
)

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

    private suspend fun sendDaemonRequest(req: DaemonRequest): DaemonResponse = withContext(Dispatchers.IO) {
        ensureDaemonStarted()
        lastUsedAtMs = System.currentTimeMillis()

        val writer = daemonWriter ?: throw IllegalStateException("Harness daemon writer not available")
        val reader = daemonReader ?: throw IllegalStateException("Harness daemon reader not available")

        writer.write(json.encodeToString(req) + "\n")
        writer.flush()

        val line = reader.readLine() ?: throw IllegalStateException("Harness daemon returned no output")
        json.decodeFromString<DaemonResponse>(line)
    }

    suspend fun executeHello(): HelloPhrases {
        val res = sendDaemonRequest(DaemonRequest(command = "hello"))
        return res.phrases ?: HelloPhrases(emptyList(), emptyList())
    }
    
    suspend fun executeMove(move: String, fen: String, difficulty: String): String {
        println("Invoking harness daemon for move: $move (Difficulty: $difficulty)")
        val res = sendDaemonRequest(DaemonRequest(command = "move", humanMove = move, fen = fen, difficulty = difficulty))
        return res.move
    }

    suspend fun executeAdvice(humanMove: String, aiMove: String, fen: String): String {
        println("Invoking harness daemon for advice")
        val res = sendDaemonRequest(DaemonRequest(command = "advice", humanMove = humanMove, aiMove = aiMove, fen = fen))
        return res.advice
    }

    suspend fun executeHint(): List<String> {
        println("Invoking harness daemon for hints")
        val res = sendDaemonRequest(DaemonRequest(command = "hint"))
        return res.hints
    }
}
