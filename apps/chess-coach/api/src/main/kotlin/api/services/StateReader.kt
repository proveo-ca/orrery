package api.services

import java.io.File

class StateReader(
    private val fenFilePath: String = resolveStatePath("game_state.fen")
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

    fun resetGame() {
        File(fenFilePath).parentFile?.mkdirs()
        File(fenFilePath).writeText(startingFen)
    }

    private companion object {
        fun resolveStatePath(fileName: String): String {
            val dir = System.getenv("CHESS_STATE_DIR")?.trim().orEmpty()
            return if (dir.isEmpty()) fileName else "$dir/$fileName"
        }
    }
}
