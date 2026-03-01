package api

import java.io.File

class StateReader(
    private val fenFilePath: String = "game_state.fen",
    private val pgnFilePath: String = "game_history.pgn"
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
        File(fenFilePath).writeText(startingFen)
        File(pgnFilePath).writeText("")
    }
}
