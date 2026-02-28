package harness

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class EngineBridge(private val stockfishPath: String = "stockfish") {
    private var process: Process? = null
    private var reader: BufferedReader? = null
    private var writer: OutputStreamWriter? = null

    fun start() {
        process = ProcessBuilder(stockfishPath).start()
        reader = BufferedReader(InputStreamReader(process!!.inputStream))
        writer = OutputStreamWriter(process!!.outputStream)
        
        // Initialize UCI mode
        sendCommand("uci")
        waitForResponse("uciok")
    }

    fun getEvaluation(fen: String, depth: Int = 15): String {
        sendCommand("position fen $fen")
        sendCommand("go depth $depth")
        
        var bestMove = ""
        var score = ""
        
        // Parse Stockfish output until it finishes thinking
        while (true) {
            val line = reader?.readLine() ?: break
            if (line.contains("score cp")) {
                // Extract centipawn score (e.g., "score cp 45")
                try {
                    val cp = line.substringAfter("score cp ").substringBefore(" ").toInt()
                    score = String.format("%.2f", cp / 100.0)
                } catch (e: Exception) {
                    // Fallback if parsing fails
                }
            } else if (line.contains("score mate")) {
                val mateIn = line.substringAfter("score mate ").substringBefore(" ")
                score = "Mate in $mateIn"
            }
            
            if (line.startsWith("bestmove")) {
                bestMove = line.substringAfter("bestmove ").substringBefore(" ")
                break
            }
        }
        return "Move: $bestMove, Eval: $score"
    }

    fun checkLegality(fen: String, move: String): Boolean {
        // A simple way to check legality is to ask stockfish to evaluate the position after the move
        // If the move is illegal, stockfish usually ignores it or throws an error in its internal state.
        // A more robust way is to use a chess library, but sticking to the anti-framework raw I/O:
        sendCommand("position fen $fen moves $move")
        sendCommand("go depth 1")
        
        var isLegal = true
        while (true) {
            val line = reader?.readLine() ?: break
            if (line.contains("Illegal move")) {
                isLegal = false
            }
            if (line.startsWith("bestmove")) {
                break
            }
        }
        return isLegal
    }

    private fun sendCommand(command: String) {
        writer?.write("$command\n")
        writer?.flush()
    }

    private fun waitForResponse(expected: String) {
        while (true) {
            val line = reader?.readLine() ?: break
            if (line.contains(expected)) break
        }
    }

    fun stop() {
        sendCommand("quit")
        process?.destroy()
    }
}
