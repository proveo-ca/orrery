// SPEC: _spec/chess-coach/harness/components.puml
// SPEC: _spec/chess-coach/harness/lifecycle.puml
package harness

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * A reusable UCI process driver with:
 *  - a background reader thread (prevents stdout buffer deadlocks)
 *  - stderr draining thread
 *  - timeout-aware line reading
 */
class UciDriver(
    private val command: List<String>,
    private val defaultTimeoutMs: Long = 15_000L
) {
    private var process: Process? = null
    private var writer: OutputStreamWriter? = null
    private val lineQueue = LinkedBlockingQueue<String>()

    @Volatile
    private var readerThread: Thread? = null

    @Volatile
    private var stderrThread: Thread? = null

    val isRunning: Boolean get() = process?.isAlive == true

    fun start() {
        if (isRunning) return

        val proc = ProcessBuilder(command)
            .redirectErrorStream(false)
            .start()

        process = proc
        writer = OutputStreamWriter(proc.outputStream)
        lineQueue.clear()

        // Background stdout reader
        readerThread = Thread({
            val reader = BufferedReader(InputStreamReader(proc.inputStream))
            try {
                while (true) {
                    val line = reader.readLine() ?: break
                    lineQueue.put(line)
                }
            } catch (_: Exception) {
                // Process closed
            }
        }, "uci-reader-${command.first()}")
        readerThread!!.isDaemon = true
        readerThread!!.start()

        // Background stderr drainer (prevents deadlock from full stderr buffer)
        stderrThread = Thread({
            val errReader = BufferedReader(InputStreamReader(proc.errorStream))
            try {
                while (true) {
                    val line = errReader.readLine() ?: break
                    System.err.println("[${command.first()}] $line")
                }
            } catch (_: Exception) {
                // Process closed
            }
        }, "uci-stderr-${command.first()}")
        stderrThread!!.isDaemon = true
        stderrThread!!.start()

        // UCI handshake
        send("uci")
        waitFor("uciok")
    }

    fun send(command: String) {
        val w = writer ?: throw IllegalStateException("UCI driver not started")
        w.write("$command\n")
        w.flush()
    }

    /**
     * Read a single line from the engine's stdout, with a timeout.
     * Returns null if the timeout expires.
     */
    fun readLine(timeoutMs: Long = defaultTimeoutMs): String? {
        return lineQueue.poll(timeoutMs, TimeUnit.MILLISECONDS)
    }

    /**
     * Block until a line containing [token] is received, or timeout.
     * Returns the matching line, or throws on timeout.
     */
    fun waitFor(token: String, timeoutMs: Long = defaultTimeoutMs): String {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (true) {
            val remaining = deadline - System.currentTimeMillis()
            if (remaining <= 0) throw UciTimeoutException("Timed out waiting for '$token'")
            val line = lineQueue.poll(remaining, TimeUnit.MILLISECONDS)
                ?: throw UciTimeoutException("Timed out waiting for '$token'")
            if (line.contains(token)) return line
        }
    }

    /**
     * Read lines until a line containing [stopToken] is found.
     * Returns all lines read (including the stop line).
     */
    fun readUntil(stopToken: String, timeoutMs: Long = defaultTimeoutMs): List<String> {
        val lines = mutableListOf<String>()
        val deadline = System.currentTimeMillis() + timeoutMs
        while (true) {
            val remaining = deadline - System.currentTimeMillis()
            if (remaining <= 0) throw UciTimeoutException("Timed out waiting for '$stopToken'")
            val line = lineQueue.poll(remaining, TimeUnit.MILLISECONDS)
                ?: throw UciTimeoutException("Timed out waiting for '$stopToken'")
            lines.add(line)
            if (line.contains(stopToken)) return lines
        }
    }

    fun stop() {
        try {
            send("quit")
        } catch (_: Exception) {
        }
        process?.destroy()
        process = null
        writer = null
        readerThread = null
        stderrThread = null
        lineQueue.clear()
    }
}

class UciTimeoutException(message: String) : RuntimeException(message)
