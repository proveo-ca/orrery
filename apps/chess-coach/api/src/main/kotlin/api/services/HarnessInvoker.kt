package api.services

import api.models.DaemonRequest
import api.models.DaemonResponse
import api.models.HelloPhrases
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.util.Timer
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.fixedRateTimer

class HarnessInvoker(private val harnessCommand: String = "./harness/bin/chess-coach-harness") {

    private val json = Json { ignoreUnknownKeys = true }

    /** Mutex serialises all daemon I/O so write+read pairs can never interleave. */
    private val daemonMutex = Mutex()

    /** Tracks in-flight requests so the idle reaper never kills a busy daemon. */
    private val inFlight = AtomicInteger(0)

    /** Per-request timeout (covers write + daemon processing + read). */
    private val requestTimeoutMs: Long =
        (System.getenv("HARNESS_REQUEST_TIMEOUT_MS") ?: "60000").toLongOrNull() ?: 60_000L

    @Volatile private var daemon: Process? = null
    @Volatile private var daemonReader: BufferedReader? = null
    @Volatile private var daemonWriter: OutputStreamWriter? = null
    @Volatile private var lastUsedAtMs: Long = 0L

    private val idleMs: Long = (System.getenv("HARNESS_IDLE_MS") ?: "60000").toLongOrNull() ?: 60_000L
    private val reaper: Timer = fixedRateTimer(name = "harness-daemon-reaper", daemon = true, initialDelay = 5_000L, period = 5_000L) {
        val p = daemon
        if (p != null && inFlight.get() == 0) {
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

    private suspend fun sendDaemonRequest(req: DaemonRequest): DaemonResponse = withTimeout(requestTimeoutMs) {
        daemonMutex.withLock {
            withContext(Dispatchers.IO) {
                inFlight.incrementAndGet()
                try {
                    ensureDaemonStarted()
                    lastUsedAtMs = System.currentTimeMillis()

                    val writer = daemonWriter
                        ?: throw IllegalStateException("Harness daemon writer not available")
                    val reader = daemonReader
                        ?: throw IllegalStateException("Harness daemon reader not available")

                    writer.write(json.encodeToString(req) + "\n")
                    writer.flush()

                    val line = reader.readLine()
                        ?: throw IllegalStateException("Harness daemon returned no output")
                    json.decodeFromString<DaemonResponse>(line)
                } finally {
                    inFlight.decrementAndGet()
                    lastUsedAtMs = System.currentTimeMillis()
                }
            }
        }
    }

    private fun sendDaemonRequestStream(req: DaemonRequest): Flow<String> = flow {
        daemonMutex.withLock {
            inFlight.incrementAndGet()
            try {
                ensureDaemonStarted()
                lastUsedAtMs = System.currentTimeMillis()

                val writer = daemonWriter
                    ?: throw IllegalStateException("Harness daemon writer not available")
                val reader = daemonReader
                    ?: throw IllegalStateException("Harness daemon reader not available")

                writer.write(json.encodeToString(req) + "\n")
                writer.flush()

                while (true) {
                    val line = reader.readLine() ?: break
                    val res = json.decodeFromString<DaemonResponse>(line)
                    if (res.chunk != null) {
                        emit(res.chunk)
                    }
                    if (res.done) {
                        break
                    }
                }
            } finally {
                inFlight.decrementAndGet()
                lastUsedAtMs = System.currentTimeMillis()
            }
        }
    }.flowOn(Dispatchers.IO)

    suspend fun executeHello(): HelloPhrases {
        val res = sendDaemonRequest(DaemonRequest(command = "hello"))
        return res.phrases ?: HelloPhrases(emptyList(), emptyList())
    }
    
    data class MoveResult(val fen: String, val move: String)

    suspend fun executeMove(humanMoveSan: String, fenAfterHuman: String, difficulty: String): MoveResult {
        println("Invoking harness daemon for move: $humanMoveSan (Difficulty: $difficulty)")
        val res = sendDaemonRequest(DaemonRequest(command = "move", humanMoveSan = humanMoveSan, fenAfterHuman = fenAfterHuman, difficulty = difficulty))
        return MoveResult(fen = res.fen, move = res.move)
    }

    fun executeAdviceStream(humanMoveSan: String, aiMove: String, fenAfterHuman: String): Flow<String> {
        println("Invoking harness daemon for advice stream")
        return sendDaemonRequestStream(DaemonRequest(command = "advice", humanMoveSan = humanMoveSan, aiMove = aiMove, fenAfterHuman = fenAfterHuman))
    }

    fun executeExplainStream(fenBefore: String, fenAfter: String, isBlunder: Boolean, moveSan: String): Flow<String> {
        println("Invoking harness daemon for explanation stream (isBlunder=$isBlunder, moveSan=$moveSan)")
        return sendDaemonRequestStream(DaemonRequest(command = "explain", fenBefore = fenBefore, fen = fenAfter, isBlunder = isBlunder, moveSan = moveSan))
    }

}
