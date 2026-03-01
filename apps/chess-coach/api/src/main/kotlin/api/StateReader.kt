package api

import java.io.File

class StateReader(
    private val fenFilePath: String = resolveStatePath("game_state.fen"),
    private val pgnFilePath: String = resolveStatePath("game_history.pgn")
) {
    private val startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    fun readFen(): String {
        val file = File(fenFilePath)
        return if (file.exists()) {
            file.readText().trim()
        } else {
            startingFen
        }
    }

    fun readPgn(): String {
        val file = File(pgnFilePath)
        return if (file.exists()) {
            file.readText().trim()
        } else {
            ""
        }
    }

    fun resetGame() {
        File(fenFilePath).parentFile?.mkdirs()
        File(pgnFilePath).parentFile?.mkdirs()
        File(fenFilePath).writeText(startingFen)
        File(pgnFilePath).writeText("")
    }

    private companion object {
        fun resolveStatePath(fileName: String): String {
            val dir = System.getenv("CHESS_STATE_DIR")?.trim().orEmpty()
            return if (dir.isEmpty()) fileName else "$dir/$fileName"
        }
    }
}
