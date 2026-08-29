package com.univcupid.app.data

import com.univcupid.app.BuildConfig

data class SupabaseConfig(
    val url: String,
    val anonKey: String,
) {
    val isConfigured: Boolean
        get() = url.startsWith("https://") && anonKey.length > 20
}

object UnivCupidBackend {
    val supabase = SupabaseConfig(
        url = BuildConfig.SUPABASE_URL,
        anonKey = BuildConfig.SUPABASE_ANON_KEY,
    )
}
