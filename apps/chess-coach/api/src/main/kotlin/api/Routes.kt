package api

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class MoveRequest(val move: String, val fen: String)

@Serializable
data class MoveResponse(val fen: String, val move: String)

@Serializable
data class AdviceRequest(val humanMove: String, val aiMove: String, val fen: String)

@Serializable
data class AdviceResponse(val advice: String)

@Serializable
data class HintResponse(val hints: List<String>)

@Serializable
data class NewGameResponse(val fen: String)

@Serializable
data class HelloResponse(
    val model: String,
    val greeting: String,
    val thinking: List<String>,
    val bestMove: List<String>
)

fun Application.configureRouting(invoker: HarnessInvoker, stateReader: StateReader) {
    routing {
        get("/hello") {
            val model = System.getenv("LLM_MODEL") ?: ""
            val phrases = invoker.executeHello()
            call.respond(
                HelloResponse(
                    model = model,
                    greeting = "Hey! I'm Selena. Let's play chess.",
                    thinking = phrases.thinking,
                    bestMove = phrases.bestMove
                )
            )
        }

        post("/move") {
            val request = call.receive<MoveRequest>()
            
            // Block and wait for the harness to complete the turn
            val aiMove = invoker.executeMove(request.move, request.fen)
            
            // Read the updated state from the file system
            val fen = stateReader.readFen()
            
            call.respond(MoveResponse(fen = fen, move = aiMove))
        }
        
        post("/advice") {
            val request = call.receive<AdviceRequest>()
            
            // Block and wait for the harness to generate advice
            val advice = invoker.executeAdvice(request.humanMove, request.aiMove, request.fen)
            
            call.respond(AdviceResponse(advice = advice))
        }
        
        get("/hint") {
            // Block and wait for the harness to generate hints
            val hints = invoker.executeHint()
            
            call.respond(HintResponse(hints = hints))
        }

        post("/new") {
            // Reset the game state files
            stateReader.resetGame()
            
            // Return the fresh starting FEN
            val fen = stateReader.readFen()
            call.respond(NewGameResponse(fen = fen))
        }
    }
}
