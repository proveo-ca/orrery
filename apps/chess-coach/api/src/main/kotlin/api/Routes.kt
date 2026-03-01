package api

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class MoveRequest(val move: String, val fen: String)

@Serializable
data class MoveResponse(val fen: String, val advice: String)

@Serializable
data class HintResponse(val hints: List<String>)

@Serializable
data class NewGameResponse(val fen: String)

fun Application.configureRouting(invoker: HarnessInvoker, stateReader: StateReader) {
    routing {
        post("/move") {
            val request = call.receive<MoveRequest>()
            
            // Block and wait for the harness to complete the turn
            val advice = invoker.executeMove(request.move, request.fen)
            
            // Read the updated state from the file system
            val fen = stateReader.readFen()
            
            call.respond(MoveResponse(fen = fen, advice = advice))
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
