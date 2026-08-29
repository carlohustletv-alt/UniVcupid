package com.univcupid.app.data

data class PublicProfile(
    val id: String,
    val displayName: String,
    val age: Int,
    val university: String,
    val course: String,
    val interests: List<String>,
    val commonVibePercent: Int,
    val avatarUrl: String = "",
)

data class QuickShareDraft(
    val activity: String,
    val caption: String = "",
    val openToCompany: Boolean = false,
    val visibility: String = "public",
    val mediaUrl: String = "",
    val localMediaUri: String = "",
)

data class VibePost(
    val id: String,
    val author: PublicProfile,
    val activity: String,
    val caption: String,
    val minutesAgo: Int,
    val reactionCount: Int,
    val openToCompany: Boolean,
    val visibility: String = "public",
    val mediaUrl: String = "",
)

data class ProfileDetail(
    val profile: PublicProfile,
    val vibesmateStatus: String,
    val posts: List<VibePost>,
)

data class VibeRequest(
    val id: String,
    val requester: PublicProfile,
)

data class VibeJoinRequest(
    val id: String,
    val vibeId: String,
    val activity: String,
    val caption: String,
    val requester: PublicProfile,
)

data class AppNotification(
    val id: String,
    val title: String,
    val body: String,
    val count: Int = 1,
)

data class CircleSummary(
    val id: String,
    val name: String,
    val icon: String,
    val description: String = "",
    val campus: String = "",
    val activeCount: Int,
    val joined: Boolean,
)

data class CircleDraft(
    val name: String,
    val icon: String,
    val description: String,
    val campus: String,
)

data class CirclePost(
    val id: String,
    val circleId: String,
    val author: PublicProfile,
    val body: String,
    val mediaUrl: String = "",
    val prompt: String = "",
    val minutesAgo: Int = 0,
    val reactionCount: Int = 0,
)

data class CirclePostDraft(
    val circleId: String,
    val body: String,
    val prompt: String = "",
    val mediaUrl: String = "",
)

data class ConversationSummary(
    val id: String,
    val title: String,
    val lastMessage: String,
)

data class ChatMessage(
    val id: String,
    val senderId: String,
    val body: String,
    val isMine: Boolean,
)

data class PrivacySettings(
    val showUniversity: Boolean = true,
    val showCourse: Boolean = true,
    val showAge: Boolean = true,
    val showOnlineStatus: Boolean = true,
    val allowDms: Boolean = true,
    val showActivities: Boolean = true,
    val appearInCupid: Boolean = true,
    val appearInVibe: Boolean = true,
)
