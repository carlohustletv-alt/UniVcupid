package com.univcupid.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLDecoder
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets

data class SupabaseSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
    val displayName: String = "",
    val university: String = "",
    val course: String = "",
)

class SupabaseAuthClient(
    private val config: SupabaseConfig = UnivCupidBackend.supabase,
) {
    private val authCallback = "univcupid://auth/callback"

    suspend fun signIn(email: String, password: String): SupabaseSession = authRequest(
        path = "/auth/v1/token?grant_type=password",
        body = JSONObject().put("email", email.trim()).put("password", password),
        allowPendingConfirmation = false,
    ) ?: error("Authentication failed")

    suspend fun signUp(email: String, password: String, displayName: String, university: String, course: String): SupabaseSession? = authRequest(
        path = "/auth/v1/signup?redirect_to=${URLEncoder.encode(authCallback, StandardCharsets.UTF_8.name())}",
        body = JSONObject().put("email", email.trim()).put("password", password).put("data", JSONObject().apply {
            put("display_name", displayName.trim())
            put("university", university.trim())
            put("course", course.trim())
        }),
        allowPendingConfirmation = true,
    )

    suspend fun requestPasswordReset(email: String) {
        authRequest("/auth/v1/recover?redirect_to=${URLEncoder.encode(authCallback, StandardCharsets.UTF_8.name())}", JSONObject().put("email", email.trim()), true)
    }

    suspend fun sessionFromCallback(uri: Uri): SupabaseSession? {
        if (uri.scheme != "univcupid" || uri.host != "auth" || uri.path != "/callback") return null
        val params = parseCallbackParams(uri)
        val accessToken = params["access_token"] ?: return null
        val refreshToken = params["refresh_token"].orEmpty()
        return fetchUserSession(accessToken, refreshToken)
    }

    private suspend fun fetchUserSession(accessToken: String, refreshToken: String): SupabaseSession = withContext(Dispatchers.IO) {
        check(config.isConfigured) { "Supabase URL and publishable key are required" }
        val connection = (URL(config.url.trimEnd('/') + "/auth/v1/user").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8_000
            readTimeout = 10_000
            setRequestProperty("apikey", config.anonKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = if (response.isBlank()) JSONObject() else JSONObject(response)
        if (connection.responseCode !in 200..299) error(json.optString("message", json.optString("msg", json.optString("error_description", json.optString("error", "Could not complete email confirmation")))))
        val metadata = json.optJSONObject("user_metadata") ?: JSONObject()
        SupabaseSession(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = json.getString("id"),
            email = json.optString("email"),
            displayName = metadata.optString("display_name"),
            university = metadata.optString("university"),
            course = metadata.optString("course"),
        )
    }

    private fun parseCallbackParams(uri: Uri): Map<String, String> {
        val pairs = mutableMapOf<String, String>()
        listOf(uri.encodedQuery.orEmpty(), uri.encodedFragment.orEmpty()).forEach { part ->
            part.split('&').filter { it.contains('=') }.forEach { pair ->
                val key = pair.substringBefore('=')
                val value = pair.substringAfter('=')
                pairs[URLDecoder.decode(key, StandardCharsets.UTF_8.name())] = URLDecoder.decode(value, StandardCharsets.UTF_8.name())
            }
        }
        return pairs
    }

    private suspend fun authRequest(path: String, body: JSONObject, allowPendingConfirmation: Boolean): SupabaseSession? = withContext(Dispatchers.IO) {
        check(config.isConfigured) { "Supabase URL and publishable key are required" }
        val connection = (URL(config.url.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8_000
            readTimeout = 10_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", config.anonKey)
        }
        connection.outputStream.use { it.write(body.toString().toByteArray()) }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = if (response.isBlank()) JSONObject() else JSONObject(response)
        if (connection.responseCode !in 200..299) error(json.optString("message", json.optString("msg", json.optString("error_description", json.optString("error", "Authentication failed")))))

        if (allowPendingConfirmation && !json.has("access_token")) return@withContext null
        val user = json.optJSONObject("user") ?: error("Supabase did not return a user. Check email confirmation settings.")
        val metadata = user.optJSONObject("user_metadata") ?: JSONObject()
        SupabaseSession(
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token"),
            userId = user.getString("id"),
            email = user.optString("email"),
            displayName = metadata.optString("display_name"),
            university = metadata.optString("university"),
            course = metadata.optString("course"),
        )
    }
}
