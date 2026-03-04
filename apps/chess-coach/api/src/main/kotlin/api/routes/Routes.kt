package api.routes

import api.models.*
import api.services.HarnessInvoker
import api.services.StateReader
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

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
            
            // fenAfterHuman is already post-human-move; harness generates AI reply from it.
            // The daemon returns the resulting FEN directly—no need to read state files.
            val result = invoker.executeMove(request.humanMoveSan, request.fenAfterHuman, request.difficulty)
            
            call.respond(MoveResponse(fen = result.fen, move = result.move))
        }
        
        post("/advice") {
            val request = call.receive<AdviceRequest>()
            
            // Block and wait for the harness to generate advice
            val advice = invoker.executeAdvice(request.humanMove, request.aiMove, request.fen)
            
            // Note: AdviceRequest keeps its own field names (humanMove/aiMove/fen)
            // because it describes a completed exchange, not a "please apply" request.
            call.respond(AdviceResponse(advice = advice))
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
