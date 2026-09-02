package com.univcupid.app.data

import org.json.JSONArray
import org.json.JSONObject

interface UnivCupidRepository {
    suspend fun ensureProfile(displayName: String, age: Int, university: String, course: String)
    suspend fun loadVibeFeed(selectedVibe: String): List<VibePost>
    suspend fun loadMyVibes(): List<VibePost>
    suspend fun loadCircles(query: String = ""): List<CircleSummary>
    suspend fun createCircle(draft: CircleDraft): CircleSummary
    suspend fun loadCirclePosts(circleId: String): List<CirclePost>
    suspend fun publishCirclePost(draft: CirclePostDraft): CirclePost
    suspend fun reactToCirclePost(postId: String, reaction: String)
    suspend fun loadCircleComments(postId: String): List<CircleComment>
    suspend fun addCircleComment(postId: String, body: String)
    suspend fun loadCupidCandidates(): List<PublicProfile>
    suspend fun loadConversations(): List<ConversationSummary>
    suspend fun loadMessages(conversationId: String): List<ChatMessage>
    suspend fun loadProfile(profileUserId: String): ProfileDetail
    suspend fun loadMyProfile(): PublicProfile
    suspend fun updateProfileAvatar(avatarUrl: String)
    suspend fun updateMyLocation(latitude: Double, longitude: Double)
    suspend fun loadNotifications(): List<AppNotification>
    suspend fun clearNotifications()
    suspend fun setBlock(targetUserId: String, blocked: Boolean)
    suspend fun getBlockState(targetUserId: String): Boolean
    suspend fun loadSafetyStatus(): SafetyStatus
    suspend fun loadMyReportStatuses(): List<ReportStatus>
    suspend fun disableMyLocation()
    suspend fun updateMyProfileDetails(displayName: String, affiliation: String, role: String, bio: String)
    suspend fun createVibeTap(): String
    suspend fun claimVibeTap(code: String)
    suspend fun loadIncomingVibeRequests(): List<VibeRequest>
    suspend fun loadIncomingVibeJoinRequests(): List<VibeJoinRequest>
    suspend fun loadVibesmates(): List<PublicProfile>
    suspend fun publishQuickShare(draft: QuickShareDraft): VibePost
    suspend fun reactToVibe(vibeId: String, reaction: String)
    suspend fun sendVibeRequest(targetUserId: String)
    suspend fun requestToJoinVibe(vibeId: String)
    suspend fun acceptVibeRequest(requestId: String)
    suspend fun declineVibeRequest(requestId: String)
    suspend fun acceptVibeJoinRequest(requestId: String)
    suspend fun declineVibeJoinRequest(requestId: String)
    suspend fun setCircleMembership(circleId: String, leave: Boolean)
    suspend fun likeCupidProfile(likedUserId: String): Boolean
    suspend fun sendMessage(conversationId: String, body: String)
    suspend fun updatePrivacy(settings: PrivacySettings)
    suspend fun sendReport(reportedUserId: String? = null, vibeId: String? = null, reason: String, details: String)
    suspend fun deleteMyVibe(vibeId: String)
    suspend fun deleteMyMessage(messageId: String)
    suspend fun deleteMyCirclePost(postId: String)
}

class SupabaseUnivCupidRepository(
    private val userId: String,
    private val rest: SupabaseRestClient,
) : UnivCupidRepository {
    override suspend fun ensureProfile(displayName: String, age: Int, university: String, course: String) {
        rest.post("profiles", JSONArray().put(JSONObject().apply {
            put("id", userId)
            put("display_name", displayName)
            put("age", age)
            put("university", university)
            put("course", course)
        }), "resolution=ignore-duplicates,return=representation")
        rest.post("privacy_settings", JSONArray().put(JSONObject().put("user_id", userId)), "resolution=merge-duplicates,return=representation")
    }

    override suspend fun loadVibeFeed(selectedVibe: String): List<VibePost> {
        val rows = rest.post("rpc/get_vibe_feed", JSONObject().apply {
            put("viewer_id", userId)
            put("selected_vibe", selectedVibe)
            put("result_limit", 20)
        })
        return List(rows.length()) { rows.getJSONObject(it).toVibePost() }
    }

    override suspend fun loadMyVibes(): List<VibePost> {
        val rows = rest.get("vibes?select=id,activity,caption,media_url,open_to_company,visibility,created_at&user_id=eq.$userId&is_deleted=eq.false&order=created_at.desc&limit=16")
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            VibePost(
                id = item.getString("id"),
                author = PublicProfile(userId, "You", 0, "", "", emptyList(), 100),
                activity = item.optString("activity"),
                caption = item.optString("caption"),
                minutesAgo = 0,
                reactionCount = 0,
                openToCompany = item.optBoolean("open_to_company"),
                visibility = item.optString("visibility", "public"),
                mediaUrl = item.optString("media_url"),
            )
        }
    }

    override suspend fun loadCircles(query: String): List<CircleSummary> {
        val rows = rest.post("rpc/search_circles_for_user", JSONObject().put("viewer_id", userId).put("search_query", query.trim()).put("result_limit", 30))
        val circles = List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            CircleSummary(item.getString("id"), item.optString("name"), item.optString("icon", "◌"), item.optString("description"), item.optString("campus"), item.optInt("active_count"), item.optBoolean("joined"))
        }
        return circles
    }

    override suspend fun createCircle(draft: CircleDraft): CircleSummary {
        val rows = rest.post("circles", JSONArray().put(JSONObject().apply {
            put("name", draft.name.trim())
            put("icon", draft.icon.trim().ifBlank { "◌" })
            put("description", draft.description.trim())
            put("campus", draft.campus.trim())
            put("created_by", userId)
        }))
        val item = rows.getJSONObject(0)
        val circleId = item.getString("id")
        rest.post("circle_members", JSONArray().put(JSONObject().put("circle_id", circleId).put("user_id", userId)), "resolution=merge-duplicates,return=representation")
        return CircleSummary(circleId, item.optString("name"), item.optString("icon", "◌"), item.optString("description"), item.optString("campus"), 1, true)
    }

    override suspend fun loadCirclePosts(circleId: String): List<CirclePost> {
        val rows = rest.post("rpc/get_circle_posts", JSONObject().put("viewer_id", userId).put("target_circle_id", circleId).put("result_limit", 25))
        return List(rows.length()) { rows.getJSONObject(it).toCirclePost() }
    }

    override suspend fun publishCirclePost(draft: CirclePostDraft): CirclePost {
        val rows = rest.post("circle_posts", JSONArray().put(JSONObject().apply {
            put("circle_id", draft.circleId)
            put("user_id", userId)
            put("body", draft.body.trim())
            put("prompt", draft.prompt.trim())
            put("media_url", draft.mediaUrl)
        }))
        val item = rows.getJSONObject(0)
        return CirclePost(item.getString("id"), draft.circleId, PublicProfile(userId, "You", 0, "", "", emptyList(), 100), item.optString("body"), item.optString("media_url"), item.optString("prompt"), 0, 0)
    }

    override suspend fun reactToCirclePost(postId: String, reaction: String) {
        rest.post("circle_post_reactions", JSONArray().put(JSONObject().put("post_id", postId).put("user_id", userId).put("reaction", reaction)), "resolution=merge-duplicates,return=representation")
    }

    override suspend fun loadCupidCandidates(): List<PublicProfile> {
        val rows = rest.post("rpc/get_cupid_candidates", JSONObject().put("viewer_id", userId).put("result_limit", 12))
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            PublicProfile(item.getString("id"), item.optString("display_name"), item.optInt("age"), item.optString("university"), item.optString("course"), emptyList(), item.optInt("common_vibe_percent"))
        }
    }

    override suspend fun loadConversations(): List<ConversationSummary> {
        val rows = rest.post("rpc/get_conversations_for_user", JSONObject().put("viewer_id", userId))
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            ConversationSummary(item.getString("id"), item.optString("title", "Conversation"), item.optString("last_message", "No messages yet"))
        }
    }

    override suspend fun loadMessages(conversationId: String): List<ChatMessage> {
        val rows = rest.get("messages?select=id,sender_id,body,created_at&conversation_id=eq.$conversationId&is_deleted=eq.false&order=created_at.desc&limit=50")
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            val senderId = item.optString("sender_id")
            ChatMessage(
                id = item.getString("id"),
                senderId = senderId,
                body = item.optString("body"),
                isMine = senderId == userId,
            )
        }.asReversed()
    }

    override suspend fun loadProfile(profileUserId: String): ProfileDetail {
        val profileRows = rest.post("rpc/get_profile_for_user", JSONObject().put("viewer_id", userId).put("profile_user_id", profileUserId))
        val item = profileRows.getJSONObject(0)
        val profile = PublicProfile(item.getString("id"), item.optString("display_name"), item.optInt("age"), item.optString("university"), item.optString("course"), emptyList(), item.optInt("common_vibe_percent"), item.optString("avatar_url"))
        val postRows = rest.post("rpc/get_profile_vibes", JSONObject().put("viewer_id", userId).put("profile_user_id", profileUserId).put("result_limit", 30))
        return ProfileDetail(profile, item.optString("vibesmate_status", "none"), List(postRows.length()) { postRows.getJSONObject(it).toVibePost() })
    }
    override suspend fun loadCircleComments(postId: String): List<CircleComment> {
        val rows = rest.post("rpc/get_circle_comments", JSONObject().put("target_post", postId))
        return List(rows.length()) { i -> rows.getJSONObject(i).let { CircleComment(it.getString("id"), it.optString("display_name"), it.optString("body"), it.optInt("minutes_ago")) } }
    }
    override suspend fun addCircleComment(postId: String, body: String) {
        rest.post("circle_comments", JSONArray().put(JSONObject().put("circle_post_id", postId).put("user_id", userId).put("body", body.trim())))
    }

    override suspend fun loadMyProfile(): PublicProfile = loadProfile(userId).profile

    override suspend fun updateProfileAvatar(avatarUrl: String) {
        rest.post("rpc/update_my_profile_avatar", JSONObject().put("p_avatar_url", avatarUrl))
    }

    override suspend fun updateMyLocation(latitude: Double, longitude: Double) {
        rest.post("rpc/update_my_location", JSONObject().put("p_latitude", latitude).put("p_longitude", longitude))
    }

    override suspend fun loadNotifications(): List<AppNotification> {
        val rows = rest.post("rpc/get_my_notifications", JSONObject())
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            AppNotification(item.getString("id"), item.optString("title"), item.optString("body"), item.optInt("notification_count", 1))
        }
    }

    override suspend fun clearNotifications() {
        rest.post("rpc/clear_my_notifications", JSONObject())
    }
    override suspend fun setBlock(targetUserId: String, blocked: Boolean) { rest.post("rpc/set_block", JSONObject().put("target_user", targetUserId).put("is_blocked", blocked)) }
    override suspend fun getBlockState(targetUserId: String): Boolean = rest.post("rpc/get_block_state", JSONObject().put("target_user", targetUserId)).optString(0).toBoolean()
    override suspend fun loadSafetyStatus(): SafetyStatus { val row = rest.post("rpc/get_my_safety_status", JSONObject()).getJSONObject(0); return SafetyStatus(row.optString("verification_status"), row.optBoolean("location_enabled")) }
    override suspend fun loadMyReportStatuses(): List<ReportStatus> { val rows = rest.post("rpc/get_my_report_statuses", JSONObject()); return List(rows.length()) { i -> rows.getJSONObject(i).let { ReportStatus(it.optString("reason"), it.optString("status")) } } }
    override suspend fun disableMyLocation() { rest.post("rpc/disable_my_location", JSONObject()) }
    override suspend fun updateMyProfileDetails(displayName: String, affiliation: String, role: String, bio: String) {
        rest.post("rpc/update_my_profile_details", JSONObject().put("p_display_name", displayName.trim()).put("p_affiliation", affiliation.trim()).put("p_role", role.trim()).put("p_bio", bio.trim()))
    }

    override suspend fun createVibeTap(): String = rest.post("rpc/create_vibe_tap", JSONObject()).getJSONObject(0).getString("code")

    override suspend fun claimVibeTap(code: String) {
        rest.post("rpc/claim_vibe_tap", JSONObject().put("tap_code", code.trim().uppercase()))
    }

    override suspend fun loadIncomingVibeRequests(): List<VibeRequest> {
        val rows = rest.post("rpc/get_incoming_vibe_requests", JSONObject().put("viewer_id", userId))
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            VibeRequest(
                id = item.getString("id"),
                requester = PublicProfile(item.getString("requester_id"), item.optString("display_name"), 0, item.optString("university"), item.optString("course"), emptyList(), 0),
            )
        }
    }

    override suspend fun loadIncomingVibeJoinRequests(): List<VibeJoinRequest> {
        val rows = rest.post("rpc/get_incoming_vibe_join_requests", JSONObject().put("viewer_id", userId))
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            VibeJoinRequest(
                id = item.getString("id"),
                vibeId = item.getString("vibe_id"),
                activity = item.optString("activity"),
                caption = item.optString("caption"),
                requester = PublicProfile(item.getString("requester_id"), item.optString("display_name"), 0, item.optString("university"), item.optString("course"), emptyList(), 0),
            )
        }
    }

    override suspend fun loadVibesmates(): List<PublicProfile> {
        val rows = rest.post("rpc/get_vibesmates", JSONObject().put("viewer_id", userId))
        return List(rows.length()) { index ->
            val item = rows.getJSONObject(index)
            PublicProfile(item.getString("id"), item.optString("display_name"), 0, item.optString("university"), item.optString("course"), emptyList(), 100)
        }
    }

    override suspend fun publishQuickShare(draft: QuickShareDraft): VibePost {
        val rows = rest.post("vibes", JSONArray().put(JSONObject().apply {
            put("user_id", userId)
            put("activity", draft.activity)
            put("caption", draft.caption)
            put("open_to_company", draft.openToCompany)
            put("visibility", draft.visibility)
            put("media_url", draft.mediaUrl)
        }))
        val item = rows.getJSONObject(0)
        return VibePost(item.getString("id"), PublicProfile(userId, "You", 18, "", "", emptyList(), 100), item.optString("activity"), item.optString("caption"), 0, 0, item.optBoolean("open_to_company"), item.optString("visibility", "public"), item.optString("media_url"))
    }

    override suspend fun reactToVibe(vibeId: String, reaction: String) {
        rest.post("vibe_reactions", JSONArray().put(JSONObject().put("vibe_id", vibeId).put("user_id", userId).put("reaction", reaction)), "resolution=merge-duplicates,return=representation")
    }

    override suspend fun sendVibeRequest(targetUserId: String) {
        rest.post("rpc/send_vibe_request", JSONObject().put("target_user", targetUserId))
    }

    override suspend fun requestToJoinVibe(vibeId: String) {
        rest.post("rpc/request_to_join_vibe", JSONObject().put("target_vibe_id", vibeId))
    }

    override suspend fun acceptVibeRequest(requestId: String) {
        rest.post("rpc/accept_vibe_request", JSONObject().put("request_id", requestId))
    }

    override suspend fun declineVibeRequest(requestId: String) {
        rest.post("rpc/decline_vibe_request", JSONObject().put("request_id", requestId))
    }

    override suspend fun acceptVibeJoinRequest(requestId: String) {
        rest.post("rpc/accept_vibe_join_request", JSONObject().put("request_id", requestId))
    }

    override suspend fun declineVibeJoinRequest(requestId: String) {
        rest.post("rpc/decline_vibe_join_request", JSONObject().put("request_id", requestId))
    }

    override suspend fun setCircleMembership(circleId: String, leave: Boolean) {
        if (leave) rest.delete("circle_members?circle_id=eq.$circleId&user_id=eq.$userId")
        else rest.post("circle_members", JSONArray().put(JSONObject().put("circle_id", circleId).put("user_id", userId)), "resolution=merge-duplicates,return=representation")
    }

    override suspend fun likeCupidProfile(likedUserId: String): Boolean {
        rest.post("likes", JSONArray().put(JSONObject().put("liker_id", userId).put("liked_id", likedUserId)), "resolution=merge-duplicates,return=representation")
        val reciprocal = rest.get("likes?select=liker_id&liker_id=eq.$likedUserId&liked_id=eq.$userId&limit=1")
        if (reciprocal.length() == 0) return false
        runCatching {
            rest.post("rpc/create_match_conversation", JSONObject().put("first_user", userId).put("second_user", likedUserId))
        }
        return true
    }

    override suspend fun sendMessage(conversationId: String, body: String) {
        rest.post("messages", JSONArray().put(JSONObject().put("conversation_id", conversationId).put("sender_id", userId).put("body", body)))
    }

    override suspend fun updatePrivacy(settings: PrivacySettings) {
        rest.post("privacy_settings", JSONArray().put(JSONObject().apply {
            put("user_id", userId)
            put("show_university", settings.showUniversity)
            put("show_course", settings.showCourse)
            put("show_age", settings.showAge)
            put("show_online_status", settings.showOnlineStatus)
            put("allow_dms", settings.allowDms)
            put("show_activities", settings.showActivities)
            put("appear_in_cupid", settings.appearInCupid)
            put("appear_in_vibe", settings.appearInVibe)
        }), "resolution=merge-duplicates,return=representation")
    }

    override suspend fun sendReport(reportedUserId: String?, vibeId: String?, reason: String, details: String) {
        rest.post("rpc/submit_report", JSONObject().apply {
            if (!reportedUserId.isNullOrBlank()) put("p_reported_user_id", reportedUserId)
            if (!vibeId.isNullOrBlank()) put("p_vibe_id", vibeId)
            put("p_reason", reason)
            put("p_details", details)
        })
    }

    override suspend fun deleteMyVibe(vibeId: String) {
        rest.post("rpc/soft_delete_vibe", JSONObject().put("target_vibe_id", vibeId))
    }

    override suspend fun deleteMyMessage(messageId: String) {
        rest.post("rpc/soft_delete_message", JSONObject().put("target_msg_id", messageId))
    }

    override suspend fun deleteMyCirclePost(postId: String) {
        rest.post("rpc/soft_delete_circle_post", JSONObject().put("target_post_id", postId))
    }

    private fun JSONObject.toVibePost(): VibePost = VibePost(
        id = getString("id"),
        author = PublicProfile(getString("author_id"), optString("display_name"), optInt("age"), optString("university"), optString("course"), emptyList(), optInt("common_vibe_percent"), optString("avatar_url")),
        activity = optString("activity"),
        caption = optString("caption"),
        minutesAgo = optInt("minutes_ago"),
        reactionCount = optInt("reaction_count"),
        openToCompany = optBoolean("open_to_company"),
        visibility = optString("visibility", "public"),
        mediaUrl = optString("media_url"),
    )

    private fun JSONObject.toCirclePost(): CirclePost = CirclePost(
        id = getString("id"),
        circleId = getString("circle_id"),
        author = PublicProfile(getString("author_id"), optString("display_name"), 0, optString("university"), optString("course"), emptyList(), 0),
        body = optString("body"),
        mediaUrl = optString("media_url"),
        prompt = optString("prompt"),
        minutesAgo = optInt("minutes_ago"),
        reactionCount = optInt("reaction_count"),
    )
}
