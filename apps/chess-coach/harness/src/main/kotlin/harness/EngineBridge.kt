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

    data class EvalResult(val bestMove: String, val cp: Int, val isMate: Boolean, val mateIn: Int = 0)

    fun getEvaluation(fen: String, depth: Int = 15): EvalResult {
        sendCommand("position fen $fen")
        sendCommand("go depth $depth")
        
        var bestMove = ""
        var cp = 0
        var isMate = false
        var mateIn = 0
        
        while (true) {
            val line = reader?.readLine() ?: break
            if (line.contains("score cp")) {
                try {
                    cp = line.substringAfter("score cp ").substringBefore(" ").toInt()
                } catch (e: Exception) {}
            } else if (line.contains("score mate")) {
                try {
                    isMate = true
                    mateIn = line.substringAfter("score mate ").substringBefore(" ").toInt()
                } catch (e: Exception) {}
            }
            
            if (line.startsWith("bestmove")) {
                bestMove = line.substringAfter("bestmove ").substringBefore(" ")
                break
            }
        }
        return EvalResult(bestMove, cp, isMate, mateIn)
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

    fun getFenAfterMove(fen: String, uciMove: String): String? {
        sendCommand("position fen $fen moves $uciMove")
        sendCommand("d") // 'd' command prints the board and the FEN
        
        var newFen = ""
        while (true) {
            val line = reader?.readLine() ?: break
            if (line.startsWith("Fen: ")) {
                newFen = line.substringAfter("Fen: ").trim()
            }
            if (line.contains("Checkers:")) {
                break
            }
        }
        
        // If Stockfish ignores the move because it's illegal, the FEN won't change
        if (newFen == fen || newFen.isEmpty()) return null
        return newFen
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
