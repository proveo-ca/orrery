package harness

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class EngineBridge(private val stockfishPath: String = "stockfish") {
    private var process: Process? = null
    private var reader: BufferedReader? = null
    private var writer: OutputStreamWriter? = null

    private var lc0Process: Process? = null
    private var lc0Reader: BufferedReader? = null
    private var lc0Writer: OutputStreamWriter? = null
    private var currentDifficulty: String? = null

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

    fun getMaiaMove(fen: String, difficulty: String): String {
        if (lc0Process == null || currentDifficulty != difficulty || !lc0Process!!.isAlive) {
            stopLc0()
            
            val weightsFile = when (difficulty) {
                "intermediate" -> "maia-1600.onnx"
                "advanced" -> "maia-2200.onnx"
                else -> "maia-1100.onnx"
            }
            
            System.err.println("Starting lc0 with weights: $weightsFile")
            lc0Process = ProcessBuilder("lc0", "--weights=/app/weights/$weightsFile").start()
            lc0Reader = BufferedReader(InputStreamReader(lc0Process!!.inputStream))
            lc0Writer = OutputStreamWriter(lc0Process!!.outputStream)
            currentDifficulty = difficulty
            
            // 1. Initialize UCI
            lc0Writer!!.write("uci\n")
            lc0Writer!!.flush()
            while (true) {
                val line = lc0Reader!!.readLine() ?: break
                System.err.println("lc0: $line")
                if (line == "uciok") break
            }
            
            // 2. Wait for neural network to finish loading
            lc0Writer!!.write("isready\n")
            lc0Writer!!.flush()
            while (true) {
                val line = lc0Reader!!.readLine() ?: break
                System.err.println("lc0: $line")
                if (line == "readyok") break
            }
        }
        
        // 3. Request the move
        lc0Writer!!.write("position fen $fen\n")
        lc0Writer!!.write("go nodes 1\n") // Maia is a policy network, 1 node is enough
        lc0Writer!!.flush()
        
        var bestMove = ""
        while (true) {
            val line = lc0Reader!!.readLine() ?: break
            System.err.println("lc0: $line")
            if (line.startsWith("bestmove")) {
                bestMove = line.substringAfter("bestmove ").substringBefore(" ")
                break
            }
        }
        
        return bestMove
    }

    private fun stopLc0() {
        try {
            lc0Writer?.write("quit\n")
            lc0Writer?.flush()
        } catch (e: Exception) {}
        lc0Process?.destroy()
        lc0Process = null
        lc0Reader = null
        lc0Writer = null
        currentDifficulty = null
    }

    fun stop() {
        sendCommand("quit")
        process?.destroy()
        stopLc0()
    }
}
