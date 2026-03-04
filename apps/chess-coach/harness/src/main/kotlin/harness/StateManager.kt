package harness

import java.io.File

class StateManager(
    private val fenFilePath: String = resolveStatePath("game_state.fen")
) {
    fun readFen(): String {
        val file = File(fenFilePath)
        return if (file.exists()) {
            file.readText().trim()
        } else {
            // Default starting position
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        }
    }

    fun writeFen(fen: String) {
        File(fenFilePath).parentFile?.mkdirs()
        File(fenFilePath).writeText(fen)
    }

    private companion object {
        fun resolveStatePath(fileName: String): String {
            val dir = System.getenv("CHESS_STATE_DIR")?.trim().orEmpty()
            return if (dir.isEmpty()) fileName else "$dir/$fileName"
        }
    }
}
