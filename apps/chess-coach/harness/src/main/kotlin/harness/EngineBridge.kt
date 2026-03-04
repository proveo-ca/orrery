package harness

/**
 * Thin facade over [StockfishEngine] and [MaiaEngine].
 *
 * Preserves the API that [Orchestrator] depends on while delegating
 * to dedicated, timeout-aware engine wrappers backed by [UciDriver].
 */
class EngineBridge(stockfishPath: String = "stockfish") {

    private val stockfish = StockfishEngine(stockfishPath)
    private val maia = MaiaEngine()

    fun start() {
        stockfish.start()
        // Maia is started lazily on first getMove() call
    }

    fun stop() {
        stockfish.stop()
        maia.stop()
    }

    // --- Stockfish delegation ---

    data class EvalResult(val bestMove: String, val cp: Int, val isMate: Boolean, val mateIn: Int = 0)

    fun getEvaluation(fen: String, depth: Int = 15): EvalResult {
        val r = stockfish.getEvaluation(fen, depth)
        return EvalResult(r.bestMove, r.cp, r.isMate, r.mateIn)
    }

    fun checkLegality(fen: String, move: String): Boolean = stockfish.checkLegality(fen, move)

    fun getFenAfterMove(fen: String, uciMove: String): String? = stockfish.getFenAfterMove(fen, uciMove)

    // --- Maia delegation ---

    fun getMaiaMove(fen: String, difficulty: String): String = maia.getMove(fen, difficulty)
}
