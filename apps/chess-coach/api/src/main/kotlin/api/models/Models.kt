package api.models

import kotlinx.serialization.Serializable

/**
 * Move request from the UI.
 * [fenAfterHuman] is the board position AFTER the human move has been applied client-side.
 * [humanMoveSan] is the human's move in Standard Algebraic Notation (for history/logging).
 */
@Serializable
data class MoveRequest(val humanMoveSan: String, val fenAfterHuman: String, val difficulty: String = "intermediate")

@Serializable
data class MoveResponse(val fen: String, val move: String)

@Serializable
data class AdviceRequest(val humanMove: String, val aiMove: String, val fen: String)

@Serializable
data class AdviceResponse(val advice: String)

@Serializable
data class ExplainRequest(val fenBefore: String, val fenAfter: String, val isBlunder: Boolean = true, val moveSan: String = "")

@Serializable
data class ExplainResponse(val explanation: String)

@Serializable
data class NewGameResponse(val fen: String)

@Serializable
data class HelloResponse(
    val model: String,
    val greeting: String,
    val thinking: List<String>,
    val bestMove: List<String>
)

@Serializable
data class HelloPhrases(val thinking: List<String>, val bestMove: List<String>)

/**
 * Request sent to the harness daemon over stdin (JSON-line protocol).
 *
 * For "move": [fenAfterHuman] is the position after the human move (applied client-side).
 *             [humanMoveSan] is the human's move in SAN (for history/logging only).
 * For "advice": [humanMoveSan], [aiMove], and [fenAfterHuman] describe the completed exchange.
 */
@Serializable
data class DaemonRequest(
    val command: String,
    val difficulty: String = "intermediate",
    val humanMoveSan: String = "",
    val aiMove: String = "",
    val fenAfterHuman: String = "",
    val fen: String = "",
    val fenBefore: String = "",
    val isBlunder: Boolean = true,
    val moveSan: String = ""
)

@Serializable
data class ErrorResponse(val error: String)

@Serializable
data class DaemonResponse(
    val fen: String = "",
    val move: String = "",
    val advice: String = "",
    val explanation: String = "",
    val hints: List<String> = emptyList(),
    val phrases: HelloPhrases? = null,
    val chunk: String? = null,
    val done: Boolean = false
)
