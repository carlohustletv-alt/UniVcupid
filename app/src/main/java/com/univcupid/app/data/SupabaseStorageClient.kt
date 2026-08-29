package com.univcupid.app.data

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class SupabaseStorageClient(
    private val config: SupabaseConfig = UnivCupidBackend.supabase,
    private val accessTokenProvider: () -> String,
) {
    suspend fun uploadVibePhoto(contentResolver: ContentResolver, uri: Uri, userId: String): String = withContext(Dispatchers.IO) {
        check(config.isConfigured) { "Connection is not configured" }
        val mimeType = "image/jpeg"
        val extension = "jpg"
        val objectPath = "$userId/${System.currentTimeMillis()}.$extension"
        val bytes = compressJpeg(contentResolver, uri, maxSide = 1280f, quality = 78)
        val endpoint = "${config.url.trimEnd('/')}/storage/v1/object/vibe-media/$objectPath"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("apikey", config.anonKey)
            setRequestProperty("Authorization", "Bearer ${accessTokenProvider()}")
            setRequestProperty("Content-Type", mimeType)
            setRequestProperty("x-upsert", "true")
        }
        connection.outputStream.use { it.write(bytes) }
        if (connection.responseCode !in 200..299) {
            val message = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            error(message.ifBlank { "Photo upload failed (${connection.responseCode})" })
        }
        "${config.url.trimEnd('/')}/storage/v1/object/public/vibe-media/$objectPath"
    }

    suspend fun encodeCompressedDataUrl(contentResolver: ContentResolver, uri: Uri): String = withContext(Dispatchers.IO) {
        "data:image/jpeg;base64,${Base64.encodeToString(compressJpeg(contentResolver, uri, maxSide = 1080f, quality = 72), Base64.NO_WRAP)}"
    }

    private fun compressJpeg(contentResolver: ContentResolver, uri: Uri, maxSide: Float, quality: Int): ByteArray {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        val largestSide = maxOf(bounds.outWidth, bounds.outHeight).coerceAtLeast(1)
        var sampleSize = 1
        while (largestSide / sampleSize > maxSide * 2) sampleSize *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val original = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) } ?: error("Could not decode selected photo")
        val scale = minOf(1f, maxSide / maxOf(original.width, original.height).toFloat())
        val bitmap = if (scale < 1f) {
            Bitmap.createScaledBitmap(original, (original.width * scale).toInt(), (original.height * scale).toInt(), true)
        } else {
            original
        }
        val output = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)
        if (bitmap !== original) bitmap.recycle()
        original.recycle()
        return output.toByteArray()
    }
}
