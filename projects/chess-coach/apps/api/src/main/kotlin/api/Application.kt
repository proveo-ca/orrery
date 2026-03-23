package api

import api.models.ErrorResponse
import api.routes.configureRouting
import api.services.HarnessInvoker
import api.services.StateReader
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import java.io.File

fun main() {
    val host = System.getenv("HOST")?.takeIf { it.isNotBlank() } ?: "0.0.0.0"
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080

    embeddedServer(Netty, port = port, host = host, module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    install(DefaultHeaders) {
        header("Cross-Origin-Opener-Policy", "same-origin")
        header("Cross-Origin-Embedder-Policy", "require-corp")
    }

    install(CORS) {
        anyHost()
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
    }

    install(StatusPages) {
        exception<IllegalStateException> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(cause.message ?: "Internal error"))
        }
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Bad request"))
        }
        exception<kotlinx.coroutines.TimeoutCancellationException> { call, cause ->
            call.respond(HttpStatusCode.GatewayTimeout, ErrorResponse("Harness request timed out"))
        }
        exception<Throwable> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(cause.message ?: "Unexpected error"))
        }
    }

    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }

    val invoker = HarnessInvoker()
    val stateReader = StateReader()

    configureRouting(invoker, stateReader)

    val staticRoot = File("static")

    routing {
        get("/") {
            call.respondRedirect("/chess")
        }

        staticFiles("/", staticRoot) {
            default("index.html")
        }
    }

    val boundHost = System.getenv("HOST")?.takeIf { it.isNotBlank() } ?: "0.0.0.0"
    val boundPort = System.getenv("PORT")?.toIntOrNull() ?: 8080

    val publicHost = System.getenv("PUBLIC_HOST")?.takeIf { it.isNotBlank() }
        ?: if (boundHost == "0.0.0.0") "localhost" else boundHost
    val publicPort = System.getenv("PUBLIC_PORT")?.toIntOrNull() ?: boundPort

    val frontendUrl = "http://$publicHost:$publicPort/chess"

    log.info("Frontend available at $frontendUrl")
}
