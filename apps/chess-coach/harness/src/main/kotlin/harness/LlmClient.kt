package harness

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ChatMessage(val role: String, val content: String)

@Serializable
data class ChatRequest(
    val model: String,
    val messages: List<ChatMessage>,
    val stream: Boolean = false,
    val temperature: Double = 0.7,
    val format: String? = null
)

@Serializable
data class ChatChoice(val message: ChatMessage)

@Serializable
data class ChatResponse(val choices: List<ChatChoice>)

class LlmClient {
    // Configuration via Environment Variables
    private val baseUrl: String = System.getenv("LLM_BASE_URL") 
        ?: System.getenv("OLLAMA_BASE_URL") 
        ?: "http://localhost:11434/v1"
        
    private val apiKey: String? = System.getenv("LLM_API_KEY")
    
    val defaultModel: String = System.getenv("LLM_MODEL") ?: "qwen2.5:7b"

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                prettyPrint = true
            })
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 15_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 15_000
        }
    }

    suspend fun prompt(
        systemPrompt: String, 
        userPrompt: String, 
        model: String = defaultModel,
        temperature: Double = 0.7,
        format: String? = null
    ): String {
        val requestPayload = ChatRequest(
            model = model,
            messages = listOf(
                ChatMessage(role = "system", content = systemPrompt),
                ChatMessage(role = "user", content = userPrompt)
            ),
            temperature = temperature,
            format = format
        )

        val response: ChatResponse = client.post("$baseUrl/chat/completions") {
            contentType(ContentType.Application.Json)
            
            // Inject API Key if provided (Required for OpenAI, Groq, etc.)
            if (!apiKey.isNullOrBlank()) {
                bearerAuth(apiKey)
            }
            
            setBody(requestPayload)
        }.body()

        return response.choices.firstOrNull()?.message?.content ?: ""
    }
    
    fun close() {
        client.close()
    }
}
