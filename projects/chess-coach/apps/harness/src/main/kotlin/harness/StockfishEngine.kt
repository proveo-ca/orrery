// SPEC: _spec/chess-coach/harness/components.puml
// SPEC: _spec/chess-coach/harness/lifecycle.puml
package harness

/**
 * Stockfish-specific UCI wrapper for evaluation, legality checking, and FEN derivation.
 */
class StockfishEngine(
    stockfishPath: String = "stockfish",
    private val defaultTimeoutMs: Long = 15_000L,
    private val syzygyPath: String? = System.getenv("SYZYGY_PATH")
) {
    private val driver = UciDriver(listOf(stockfishPath), defaultTimeoutMs)

    fun start() {
        driver.start()
        if (!syzygyPath.isNullOrBlank()) {
            driver.send("setoption name SyzygyPath value $syzygyPath")
        }
    }
    fun stop() = driver.stop()
    val isRunning: Boolean get() = driver.isRunning

    data class EvalResult(val bestMove: String, val cp: Int, val isMate: Boolean, val mateIn: Int = 0)

    fun getEvaluation(fen: String, depth: Int = 15): EvalResult {
        driver.send("position fen $fen")
        driver.send("go depth $depth")

        var bestMove = ""
        var cp = 0
        var isMate = false
        var mateIn = 0

        val lines = driver.readUntil("bestmove", defaultTimeoutMs)
        for (line in lines) {
            if (line.contains("score cp")) {
                try {
                    cp = line.substringAfter("score cp ").substringBefore(" ").toInt()
                } catch (_: Exception) {
                }
            } else if (line.contains("score mate")) {
                try {
                    isMate = true
                    mateIn = line.substringAfter("score mate ").substringBefore(" ").toInt()
                } catch (_: Exception) {
                }
            }
            if (line.startsWith("bestmove")) {
                bestMove = line.substringAfter("bestmove ").substringBefore(" ")
            }
        }
        return EvalResult(bestMove, cp, isMate, mateIn)
    }

    fun checkLegality(fen: String, move: String): Boolean {
        driver.send("position fen $fen moves $move")
        driver.send("go depth 1")

        var isLegal = true
        val lines = driver.readUntil("bestmove", defaultTimeoutMs)
        for (line in lines) {
            if (line.contains("Illegal move")) {
                isLegal = false
            }
        }
        return isLegal
    }

    fun getFenAfterMove(fen: String, uciMove: String): String? {
        driver.send("position fen $fen moves $uciMove")
        driver.send("d")

        var newFen = ""
        val lines = driver.readUntil("Checkers:", defaultTimeoutMs)
        for (line in lines) {
            if (line.startsWith("Fen: ")) {
                newFen = line.substringAfter("Fen: ").trim()
            }
        }

        if (newFen == fen || newFen.isEmpty()) return null
        return newFen
    }
}
