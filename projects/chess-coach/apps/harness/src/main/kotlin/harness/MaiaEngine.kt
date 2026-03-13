package harness

/**
 * Maia/lc0-specific UCI wrapper with difficulty-based weight switching.
 * Restarts the engine when the difficulty (and thus weights file) changes.
 */
class MaiaEngine(
    private val weightsDir: String = "/app/weights",
    private val defaultTimeoutMs: Long = 30_000L
) {
    private var driver: UciDriver? = null
    private var currentDifficulty: String? = null

    val isRunning: Boolean get() = driver?.isRunning == true

    fun getMove(fen: String, difficulty: String): String {
        ensureReady(difficulty)

        val d = driver ?: throw IllegalStateException("Maia engine not started")
        d.send("position fen $fen")
        d.send("go nodes 1") // Maia is a policy network; 1 node is enough

        val lines = d.readUntil("bestmove", defaultTimeoutMs)
        
        var bestMove = ""

        for (line in lines) {
            if (line.startsWith("bestmove")) {
                bestMove = line.substringAfter("bestmove ").substringBefore(" ").trim()
            }
        }

        if (bestMove.isNotEmpty()) {
            return bestMove
        }
        throw IllegalStateException("Maia did not return a bestmove")
    }

    private fun ensureReady(difficulty: String) {
        if (driver != null && currentDifficulty == difficulty && driver!!.isRunning) return

        stop()

        val weightsFile = when (difficulty) {
            "advanced" -> "maia-1600.pb.gz"
            "expert" -> "maia-2200.pb.gz"
            else -> "maia-1100.pb.gz"
        }

        System.err.println("Starting lc0 with weights: $weightsFile")

        val d = UciDriver(
            listOf("lc0", "--weights=$weightsDir/$weightsFile", "--backend=blas"),
            defaultTimeoutMs
        )
        d.start()

        // Enable the Polyglot opening book
        d.send("setoption name OwnBook value true")
        d.send("setoption name BookFile value $weightsDir/openings.bin")

        // Configure Lc0 for more dynamic/stochastic play
        d.send("setoption name Temperature value 0.5")

        // Wait for neural network to finish loading
        d.send("isready")
        d.waitFor("readyok", defaultTimeoutMs)

        driver = d
        currentDifficulty = difficulty
    }

    fun stop() {
        driver?.stop()
        driver = null
        currentDifficulty = null
    }
}
