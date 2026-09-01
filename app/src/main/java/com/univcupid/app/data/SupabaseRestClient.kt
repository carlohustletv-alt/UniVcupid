package com.univcupid.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SupabaseRestClient(
    private val config: SupabaseConfig = UnivCupidBackend.supabase,
    private val accessTokenProvider: () -> String,
) {
    suspend fun get(path: String): JSONArray = request("GET", path)

    suspend fun post(path: String, body: Any, prefer: String = "return=representation"): JSONArray = request("POST", path, body, prefer)

    suspend fun delete(path: String): JSONArray = request("DELETE", path, prefer = "return=representation")

    private suspend fun request(method: String, path: String, body: Any? = null, prefer: String = ""): JSONArray = withContext(Dispatchers.IO) {
        check(config.isConfigured) { "Connection is not configured" }
        val connection = (URL(config.url.trimEnd('/') + "/rest/v1/" + path.trimStart('/')).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8_000
            readTimeout = 10_000
            setRequestProperty("apikey", config.anonKey)
            setRequestProperty("Authorization", "Bearer ${accessTokenProvider()}")
            setRequestProperty("Content-Type", "application/json")
            if (prefer.isNotBlank()) setRequestProperty("Prefer", prefer)
            if (body != null) doOutput = true
        }
        if (body != null) {
            val json = when (body) {
                is JSONObject -> body.toString()
                is JSONArray -> body.toString()
                else -> body.toString()
            }
            connection.outputStream.use { it.write(json.toByteArray()) }
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) {
            val message = runCatching { JSONObject(text).optString("message") }.getOrNull().orEmpty()
            error(message.ifBlank { "Connection failed (${connection.responseCode})" })
        }
        when {
            text.isBlank() -> JSONArray()
            text.trimStart().startsWith("[") -> JSONArray(text)
            text.trimStart().startsWith("{") -> JSONArray().put(JSONObject(text))
            else -> JSONArray().put(text.trim().trim('"'))
        }
    }
}
