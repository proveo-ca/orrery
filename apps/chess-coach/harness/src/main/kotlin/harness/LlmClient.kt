package harness

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.utils.io.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.SerialName
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
    val format: String? = null,
    @SerialName("max_tokens") val maxTokens: Int? = null
)

@Serializable
data class ChatChoice(val message: ChatMessage)

@Serializable
data class ChatResponse(val choices: List<ChatChoice>)

@Serializable
data class ChatChunkChoice(val delta: ChatMessage)

@Serializable
data class ChatChunkResponse(val choices: List<ChatChunkChoice>)

class LlmClient {
    // Configuration via Environment Variables
    private val baseUrl: String = System.getenv("LLM_BASE_URL") 
        ?: System.getenv("OLLAMA_BASE_URL") 
        ?: "http://localhost:11434/v1"
        
    private val apiKey: String? = System.getenv("LLM_API_KEY")
    
    val generalModel: String = System.getenv("LLM_GENERAL_MODEL") ?: System.getenv("LLM_MODEL") ?: "qwen2.5:7b"
    val commentaryModel: String = System.getenv("LLM_COMMENTARY_MODEL") ?: generalModel

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                prettyPrint = true
            })
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 30_000
            connectTimeoutMillis = 30_000
            socketTimeoutMillis = 30_000
        }
    }

    suspend fun prompt(
        systemPrompt: String, 
        userPrompt: String, 
        model: String = commentaryModel,
        temperature: Double = 0.7,
        format: String? = null,
        maxTokens: Int? = null
    ): String {
        val requestPayload = ChatRequest(
            model = model,
            messages = listOf(
                ChatMessage(role = "system", content = systemPrompt),
                ChatMessage(role = "user", content = userPrompt)
            ),
            temperature = temperature,
            format = format,
            maxTokens = maxTokens
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

    suspend fun promptStream(
        systemPrompt: String, 
        userPrompt: String, 
        model: String = commentaryModel,
        temperature: Double = 0.7,
        maxTokens: Int? = null
    ): Flow<String> = flow {
        val requestPayload = ChatRequest(
            model = model,
            messages = listOf(
                ChatMessage(role = "system", content = systemPrompt),
                ChatMessage(role = "user", content = userPrompt)
            ),
            stream = true,
            temperature = temperature,
            maxTokens = maxTokens
        )

        val jsonParser = Json { ignoreUnknownKeys = true }

        client.preparePost("$baseUrl/chat/completions") {
            contentType(ContentType.Application.Json)
            if (!apiKey.isNullOrBlank()) {
                bearerAuth(apiKey)
            }
            setBody(requestPayload)
        }.execute { response ->
            val channel = response.bodyAsChannel()
            while (!channel.isClosedForRead) {
                val line = channel.readUTF8Line() ?: break
                if (line.startsWith("data: ") && line != "data: [DONE]") {
                    val jsonStr = line.removePrefix("data: ")
                    try {
                        val chunk = jsonParser.decodeFromString<ChatChunkResponse>(jsonStr)
                        val content = chunk.choices.firstOrNull()?.delta?.content ?: ""
                        if (content.isNotEmpty()) {
                            emit(content)
                        }
                    } catch (e: Exception) {
                        // Ignore parse errors for partial/malformed chunks
                    }
                }
            }
        }
    }
    
    fun close() {
        client.close()
    }
}
