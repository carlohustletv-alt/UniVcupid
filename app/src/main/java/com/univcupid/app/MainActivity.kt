package com.univcupid.app

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.location.LocationManager
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.univcupid.app.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Ink = Color(0xFF161226)
private val Violet = Color(0xFF6D4AFF)
private val VioletLight = Color(0xFFF0ECFF)
private val Coral = Color(0xFFFF5E7E)
private val Paper = Color(0xFFFAF9FE)
private val Muted = Color(0xFF857E9B)
private val Mint = Color(0xFF10B981)

class MainActivity : ComponentActivity() {
    private var callbackUri by mutableStateOf<Uri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        callbackUri = intent?.data
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Violet, background = Paper, surface = Color.White)) {
                UnivCupidApp(callbackUri)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        callbackUri = intent.data
    }
}

private enum class Tab(val label: String, val icon: String) { VIBE("Vibe", "✦"), CIRCLES("Circles", "◌"), CUPID("Cupid", "♡"), CHATS("Chats", "▣"), YOU("You", "◉") }

@Composable
private fun UnivCupidApp(callbackUri: Uri?) {
    var session by remember { mutableStateOf<SupabaseSession?>(null) }
    var callbackError by remember { mutableStateOf<String?>(null) }
    val auth = remember { SupabaseAuthClient() }

    LaunchedEffect(callbackUri) {
        val uri = callbackUri ?: return@LaunchedEffect
        runCatching { auth.sessionFromCallback(uri) }
            .onSuccess { confirmedSession -> if (confirmedSession != null) session = confirmedSession }
            .onFailure { callbackError = it.message ?: "Could not complete email confirmation" }
    }

    if (session == null) {
        AuthScreen(callbackError = callbackError) { session = it }
        return
    }

    val activeSession = session ?: return
    val repository = remember(activeSession.accessToken) {
        SupabaseUnivCupidRepository(
            userId = activeSession.userId,
            rest = SupabaseRestClient(accessTokenProvider = { activeSession.accessToken }),
        )
    }
    val context = LocalContext.current
    val storage = remember(activeSession.accessToken) {
        SupabaseStorageClient(accessTokenProvider = { activeSession.accessToken })
    }
    var tab by rememberSaveable { mutableStateOf(Tab.VIBE) }
    var shareOpen by rememberSaveable { mutableStateOf(false) }
    var toast by remember { mutableStateOf<String?>(null) }
    var selectedPhoto by remember { mutableStateOf<VibePost?>(null) }
    var selectedProfileId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val pulse by rememberInfiniteTransition(label = "fabPulse").animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Reverse),
        label = "fabScale",
    )

    selectedProfileId?.let { profileId ->
        ProfileDetailScreen(repository, profileId, onBack = { selectedProfileId = null }, openPhoto = { selectedPhoto = it }) { toast = it }
        selectedPhoto?.let { FullscreenPhoto(it) { selectedPhoto = null } }
        return
    }

    Scaffold(containerColor = Paper, bottomBar = { Navigation(tab) { tab = it } }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            AnimatedContent(
                targetState = tab,
                transitionSpec = {
                    (fadeIn(tween(180)) + slideInHorizontally(tween(220)) { it / 4 }) togetherWith
                        (fadeOut(tween(140)) + slideOutHorizontally(tween(180)) { -it / 5 }) using SizeTransform(clip = false)
                },
                label = "tabTransition",
            ) { activeTab ->
                when (activeTab) {
                    Tab.VIBE -> VibeScreen(repository, openPhoto = { selectedPhoto = it }, openProfile = { selectedProfileId = it }) { toast = it }
                    Tab.CIRCLES -> CirclesScreen(repository, storage, activeSession.userId) { toast = it }
                    Tab.CUPID -> CupidScreen(repository) { toast = it }
                    Tab.CHATS -> ChatsScreen(repository, openProfile = { selectedProfileId = it }) { toast = it }
                    Tab.YOU -> ProfileScreen(activeSession, repository, storage, onSignOut = { session = null }, openPhoto = { selectedPhoto = it }, openProfile = { selectedProfileId = it }) { toast = it }
                }
            }
            if (tab == Tab.VIBE) {
                FloatingActionButton(
                    onClick = { shareOpen = true },
                    containerColor = Violet,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp).height(44.dp).graphicsLayer { scaleX = pulse; scaleY = pulse },
                ) { Text("+ QUICK SHARE", Modifier.padding(horizontal = 14.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
            AnimatedVisibilityToast(toast)
        }
    }
    selectedPhoto?.let { FullscreenPhoto(it) { selectedPhoto = null } }

    toast?.let { LaunchedEffect(it) { delay(2600); toast = null } }
    if (shareOpen) ShareSheet2(onDismiss = { shareOpen = false }) { draft ->
        shareOpen = false
        scope.launch {
            runCatching {
                val uploadedUrl = if (draft.localMediaUri.isNotBlank()) {
                    val uri = android.net.Uri.parse(draft.localMediaUri)
                    storage.uploadVibePhoto(context.contentResolver, uri, activeSession.userId)
                } else {
                    draft.mediaUrl
                }
                repository.publishQuickShare(draft.copy(mediaUrl = uploadedUrl))
            }
                .onSuccess { toast = "You're live on Vibe" }
                .onFailure { toast = it.message ?: "Could not post Vibe" }
        }
    }
}

@Composable
private fun AuthScreen(callbackError: String?, onAuthenticated: (SupabaseSession) -> Unit) {
    val scope = rememberCoroutineScope()
    val auth = remember { SupabaseAuthClient() }
    var mode by rememberSaveable { mutableStateOf("signup") } // "signup", "signin"
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var university by rememberSaveable { mutableStateOf("") }
    var course by rememberSaveable { mutableStateOf("") }
    var mood by rememberSaveable { mutableStateOf("☕") }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var info by rememberSaveable { mutableStateOf<String?>(null) }

    LazyColumn(
        Modifier.fillMaxSize().background(Paper).padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LogoMark(36)
                    Text("UnivCupid", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
                }
                Surface(color = Mint.copy(alpha = 0.15f), shape = RoundedCornerShape(16.dp)) {
                    Text("Live Campus", Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Mint)
                }
            }
        }

        // Holographic Campus Passport Preview Card
        item {
            Surface(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)),
                color = Color.Transparent,
                shadowElevation = 8.dp
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.linearGradient(listOf(Violet, Color(0xFF8C68FF), Coral)))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Color.White.copy(alpha = 0.25f), shape = RoundedCornerShape(12.dp)) {
                                Text("🎓 ${university.ifBlank { "Your university" }}", Modifier.padding(horizontal = 8.dp, vertical = 3.dp), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Text("VERIFIED STUDENT ID", color = Color.White.copy(alpha = 0.85f), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                                Text(mood, fontSize = 28.sp)
                            }
                            Column {
                                Text(name.ifBlank { "Your Name" }, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Text("B.S. ${course.ifBlank { "Degree" }} · Year 3", color = Color.White.copy(alpha = 0.9f), fontSize = 11.sp)
                                Text("PASS #2026-${(1000..9999).random()}", color = Color.White.copy(alpha = 0.75f), fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }

        // Mode Switcher Tabs
        item {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color.White).padding(4.dp)) {
                listOf("signup" to "🎓 Issue ID", "signin" to "🔑 Sign In").forEach { (tabKey, label) ->
                    val isSelected = mode == tabKey
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) Violet else Color.Transparent)
                            .clickable { mode = tabKey }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = if (isSelected) Color.White else Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (mode == "signup") {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(name, { name = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    
                    OutlinedTextField(university, { university = it.take(100) }, label = { Text("University") }, placeholder = { Text("Enter your university") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(course, { course = it }, label = { Text("Degree / Major") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(email, { email = it }, label = { Text("Student Email") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                    callbackError?.let { Text(it, color = Coral, fontSize = 12.sp) }
                    info?.let { Text(it, color = Mint, fontSize = 12.sp) }
                    error?.let { Text(it, color = Coral, fontSize = 12.sp) }

                    Button(
                        enabled = !loading && name.isNotBlank() && university.isNotBlank() && course.isNotBlank() && email.isNotBlank() && password.length >= 6,
                        onClick = {
                            loading = true
                            error = null
                            info = null
                            scope.launch {
                                runCatching {
                                    val session = auth.signUp(email, password, name, university, course)
                                    if (session == null) return@runCatching null
                                    SupabaseUnivCupidRepository(userId = session.userId, rest = SupabaseRestClient(accessTokenProvider = { session.accessToken }))
                                        .ensureProfile(name, 21, university, course)
                                    session
                                }.onSuccess { session ->
                                    loading = false
                                    if (session == null) {
                                        info = "Check your email to confirm your account, then sign in."
                                        mode = "signin"
                                    } else {
                                        onAuthenticated(session)
                                    }
                                }
                                    .onFailure { loading = false; error = it.message ?: "Could not create account" }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Violet),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) { Text(if (loading) "Issuing Passport..." else "Issue Campus Passport ✦", fontWeight = FontWeight.Bold) }
                }
            }
        } else {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                    callbackError?.let { Text(it, color = Coral, fontSize = 12.sp) }
                    info?.let { Text(it, color = Mint, fontSize = 12.sp) }
                    error?.let { Text(it, color = Coral, fontSize = 12.sp) }

                    Button(
                        enabled = !loading && email.isNotBlank() && password.length >= 6,
                        onClick = {
                            loading = true
                            error = null
                            info = null
                            scope.launch {
                                runCatching {
                                    val session = auth.signIn(email, password)
                                    SupabaseUnivCupidRepository(userId = session.userId, rest = SupabaseRestClient(accessTokenProvider = { session.accessToken }))
                                        .ensureProfile(
                                            session.displayName.ifBlank { session.email.substringBefore("@").ifBlank { "Student" } },
                                            21,
                                            session.university,
                                            session.course,
                                        )
                                    session
                                }.onSuccess { loading = false; onAuthenticated(it) }
                                    .onFailure { loading = false; error = it.message ?: "Authentication failed" }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Violet),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) { Text(if (loading) "Signing In..." else "Sign In to Campus ✦", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun VibeScreen(repository: UnivCupidRepository, openPhoto: (VibePost) -> Unit, openProfile: (String) -> Unit, notify: (String) -> Unit) {
    var selected by rememberSaveable { mutableStateOf("All") }
    var posts by remember { mutableStateOf<List<VibePost>>(emptyList()) }
    var reportingPost by remember { mutableStateOf<VibePost?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun load() { scope.launch { loading = true; runCatching { repository.loadVibeFeed(selected) }.onSuccess { posts = it; error = null }.onFailure { error = it.message }; loading = false } }
    LaunchedEffect(selected) { load() }

    reportingPost?.let { post ->
        ReportDialog(
            targetName = "${post.author.displayName}'s Vibe",
            onDismiss = { reportingPost = null },
            onSubmit = { reason, details ->
                scope.launch {
                    runCatching { repository.sendReport(reportedUserId = post.author.id, vibeId = post.id, reason = reason, details = details) }
                        .onSuccess { notify("Report submitted for Super Admin review 🛡️"); reportingPost = null }
                        .onFailure { notify(it.message ?: "Could not submit report") }
                }
            }
        )
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Header("Vibe", "See what campus is doing right now") }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("All", "Coffee", "Study", "Gaming", "Food", "Dating")) { vibe ->
                    FilterChip(selected == vibe, { selected = vibe }, { Text(vibe) })
                }
            }
        }
        if (loading) item { LoadingCard("Loading Vibe feed...") }
        else if (error != null) item { ErrorCard(error.orEmpty()) { load() } }
        else if (posts.isEmpty()) item { EmptyCard("No Vibes yet", "Post a QuickShare to start campus activity.") }
        else items(posts, key = { it.id }) { post ->
            VibePostCard(
                post = post,
                openPhoto = openPhoto,
                openProfile = openProfile,
                onReport = { reportingPost = post },
                onJoinPlan = {
                    scope.launch {
                        runCatching { repository.requestToJoinVibe(post.id) }
                            .onSuccess { notify("Join request sent to ${post.author.displayName}") }
                            .onFailure { notify(it.message ?: "Could not request to join") }
                    }
                },
                react = { reaction ->
                    scope.launch {
                        runCatching { repository.reactToVibe(post.id, reaction) }
                            .onSuccess { notify("Reaction sent") }
                            .onFailure { notify(it.message ?: "Reaction failed") }
                    }
                }
            )
        }
    }
}

@Composable
private fun CirclesScreen(repository: UnivCupidRepository, storage: SupabaseStorageClient, userId: String, notify: (String) -> Unit) {
    var circles by remember { mutableStateOf<List<CircleSummary>>(emptyList()) }
    var query by rememberSaveable { mutableStateOf("") }
    var showCreate by rememberSaveable { mutableStateOf(false) }
    var selectedCircle by remember { mutableStateOf<CircleSummary?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    selectedCircle?.let { circle ->
        CircleRoomScreen(repository, storage, userId, circle, onBack = { selectedCircle = null }) { notify(it) }
        return
    }

    fun load() {
        scope.launch {
            loading = true
            runCatching { repository.loadCircles(query) }
                .onSuccess { circles = it; error = null }
                .onFailure { error = it.message }
            loading = false
        }
    }

    LaunchedEffect(query) { load() }

    if (showCreate) {
        CreateCircleSheet(
            onDismiss = { showCreate = false },
            onCreate = { draft ->
                scope.launch {
                    runCatching { repository.createCircle(draft) }
                        .onSuccess { showCreate = false; notify("Circle created"); query = ""; load() }
                        .onFailure { notify(it.message ?: "Could not create Circle") }
                }
            }
        )
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Header("Circles", "Campus rooms built around interests") }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it.take(80) },
                label = { Text("Search Circles") },
                placeholder = { Text("Coffee, gaming, CLSU...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
        }
        item { Button({ showCreate = true }, colors = ButtonDefaults.buttonColors(containerColor = Violet), modifier = Modifier.fillMaxWidth()) { Text("Create Circle +", fontWeight = FontWeight.Bold) } }
        if (loading) item { LoadingCard("Loading Circles...") }
        else if (error != null) item { ErrorCard(error.orEmpty()) { load() } }
        else if (circles.isEmpty()) item { EmptyCard("No Circles found", "Create the first Circle for this campus interest.") }
        else items(circles, key = { it.id }) { circle ->
            CircleCard(circle, open = { if (circle.joined) selectedCircle = circle else notify("Join this Circle first") }) { leave ->
                scope.launch {
                    runCatching { repository.setCircleMembership(circle.id, leave) }
                        .onSuccess { notify(if (leave) "Left ${circle.name}" else "Joined ${circle.name}"); load() }
                        .onFailure { notify(it.message ?: "Circle action failed") }
                }
            }
        }
    }
}

@Composable
private fun CircleRoomScreen(repository: UnivCupidRepository, storage: SupabaseStorageClient, userId: String, circle: CircleSummary, onBack: () -> Unit, notify: (String) -> Unit) {
    var posts by remember { mutableStateOf<List<CirclePost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var body by rememberSaveable { mutableStateOf("") }
    var prompt by rememberSaveable { mutableStateOf("Today's idea") }
    var photoUri by rememberSaveable { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> photoUri = uri?.toString().orEmpty() }
    val prompts = listOf("Today's idea", "Study hack", "Campus food find", "Event plan", "Question", "Photo dump")
    fun load() { scope.launch { loading = true; runCatching { repository.loadCirclePosts(circle.id) }.onSuccess { posts = it; error = null }.onFailure { error = it.message }; loading = false } }
    LaunchedEffect(circle.id) { load() }

    LazyColumn(Modifier.fillMaxSize().background(Paper), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { TextButton(onBack) { Text("‹ Back to Circles") } }
        item {
            Surface(shape = RoundedCornerShape(24.dp), color = Ink, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.background(Brush.linearGradient(listOf(Violet, Ink))).padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${circle.icon} ${circle.name}", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Text(circle.description.ifBlank { "Share photos, ideas, plans, and campus finds with this Circle." }, color = Color.White.copy(alpha = .84f), fontSize = 13.sp)
                    Text("${circle.campus.ifBlank { "Campus" }} · ${circle.activeCount} members", color = Color(0xFFFFD0D9), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Surface(shape = RoundedCornerShape(20.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Start something fun", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(prompts) { item -> FilterChip(prompt == item, { prompt = item }, { Text(item) }) } }
                    OutlinedTextField(body, { body = it.take(500) }, placeholder = { Text("Drop an idea, invite, tip, or campus story...") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
                    if (photoUri.isNotBlank()) VibePhoto(photoUri, "Selected Circle photo", Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(16.dp)))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton({ launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Text(if (photoUri.isBlank()) "Add photo" else "Change photo") }
                        Button({
                            val text = body.trim()
                            if (text.isNotBlank()) scope.launch {
                                runCatching {
                                    val media = if (photoUri.isNotBlank()) storage.uploadVibePhoto(context.contentResolver, android.net.Uri.parse(photoUri), userId) else ""
                                    repository.publishCirclePost(CirclePostDraft(circle.id, text, prompt, media))
                                }.onSuccess { body = ""; photoUri = ""; notify("Posted in ${circle.name}"); load() }.onFailure { notify(it.message ?: "Could not post") }
                            }
                        }, enabled = body.trim().isNotBlank(), colors = ButtonDefaults.buttonColors(containerColor = Coral)) { Text("Post") }
                    }
                }
            }
        }
        if (loading) item { LoadingCard("Loading room feed...") }
        else if (error != null) item { ErrorCard(error.orEmpty()) { load() } }
        else if (posts.isEmpty()) item { EmptyCard("Quiet room", "Be the first to post a plan, photo, or idea.") }
        else items(posts, key = { it.id }) { post ->
            CirclePostCard(
                post = post,
                canDelete = post.author.id == userId,
                react = { reaction ->
                    scope.launch {
                        runCatching { repository.reactToCirclePost(post.id, reaction) }
                            .onSuccess { notify("Reaction sent"); load() }
                            .onFailure { notify(it.message ?: "Reaction failed") }
                    }
                },
                delete = {
                    scope.launch {
                        runCatching { repository.deleteMyCirclePost(post.id) }
                            .onSuccess { notify("Post removed from ${circle.name}"); load() }
                            .onFailure { notify(it.message ?: "Could not delete post") }
                    }
                },
            )
        }
    }
}

@Composable
private fun CupidScreen(repository: UnivCupidRepository, notify: (String) -> Unit) {
    var people by remember { mutableStateOf<List<PublicProfile>>(emptyList()) }
    var reportingCandidate by remember { mutableStateOf<PublicProfile?>(null) }
    var index by rememberSaveable { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun load() { scope.launch { loading = true; runCatching { repository.loadCupidCandidates() }.onSuccess { people = it; error = null; index = 0 }.onFailure { error = it.message }; loading = false } }
    LaunchedEffect(Unit) { load() }

    reportingCandidate?.let { candidate ->
        ReportDialog(
            targetName = candidate.displayName,
            onDismiss = { reportingCandidate = null },
            onSubmit = { reason, details ->
                scope.launch {
                    runCatching { repository.sendReport(reportedUserId = candidate.id, reason = reason, details = details) }
                        .onSuccess { notify("Report submitted for Super Admin review 🛡️"); reportingCandidate = null }
                        .onFailure { notify(it.message ?: "Could not submit report") }
                }
            }
        )
    }

    Column(Modifier.fillMaxSize().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Header("Cupid", "18+ dating discovery")
        Spacer(Modifier.height(14.dp))
        when {
            loading -> LoadingCard("Loading candidates...")
            error != null -> ErrorCard(error.orEmpty()) { load() }
            people.isEmpty() -> EmptyCard("No Cupid candidates", "Wait for more verified student profiles.")
            else -> {
                val person = people[index.coerceAtMost(people.lastIndex)]
                CupidCard(person, onReport = { reportingCandidate = person })
                Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = { if (index < people.lastIndex) index++ else load() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Ink),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 3.dp),
                        modifier = Modifier.weight(1f).height(48.dp)
                    ) { Text("💔 Pass", fontWeight = FontWeight.Bold, fontSize = 14.sp) }

                    Button(
                        onClick = {
                            scope.launch {
                                runCatching { repository.likeCupidProfile(person.id) }
                                    .onSuccess { matched ->
                                        notify(if (matched) "✨ You found a vibe match!" else "Interest sent! 💌")
                                        if (index < people.lastIndex) index++ else load()
                                    }
                                    .onFailure { notify(it.message ?: "Like failed") }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Coral),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
                        modifier = Modifier.weight(1f).height(48.dp)
                    ) { Text("💖 Interested", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                }
            }
        }
    }
}

@Composable
private fun ChatsScreen(repository: UnivCupidRepository, openProfile: (String) -> Unit, notify: (String) -> Unit) {
    var conversations by remember { mutableStateOf<List<ConversationSummary>>(emptyList()) }
    var requests by remember { mutableStateOf<List<VibeRequest>>(emptyList()) }
    var mates by remember { mutableStateOf<List<PublicProfile>>(emptyList()) }
    var selectedConversation by remember { mutableStateOf<ConversationSummary?>(null) }
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var messageText by rememberSaveable { mutableStateOf("") }
    var showVibeTap by rememberSaveable { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun load() { scope.launch { loading = true; runCatching { repository.loadConversations() }.onSuccess { conversations = it; error = null }.onFailure { error = it.message }; loading = false } }
    fun loadConnections() {
        scope.launch {
            runCatching { repository.loadIncomingVibeRequests() }.onSuccess { requests = it }
            runCatching { repository.loadVibesmates() }.onSuccess { mates = it }
        }
    }
    fun loadMessages(conversation: ConversationSummary) { scope.launch { loading = true; runCatching { repository.loadMessages(conversation.id) }.onSuccess { messages = it; error = null }.onFailure { error = it.message }; loading = false } }
    LaunchedEffect(Unit) { load(); loadConnections() }

    if (showVibeTap) {
        VibeTapSheet(repository, onDismiss = { showVibeTap = false }) { message ->
            notify(message)
            loadConnections()
            load()
        }
    }

    selectedConversation?.let { conversation ->
        Column(Modifier.fillMaxSize().padding(18.dp)) {
            TextButton(onClick = { selectedConversation = null; load() }) { Text("‹ Back to Chats") }
            Header(conversation.title, "Live conversation")
            Spacer(Modifier.height(12.dp))
            if (loading) LoadingCard("Loading messages...")
            else if (error != null) ErrorCard(error.orEmpty()) { loadMessages(conversation) }
            else LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (messages.isEmpty()) item { EmptyCard("No messages yet", "Send the first campus hello.") }
                else items(messages, key = { it.id }) { message ->
                    MessageBubble(
                        message = message,
                        onDelete = {
                            scope.launch {
                                runCatching { repository.deleteMyMessage(message.id) }
                                    .onSuccess { notify("Message deleted"); loadMessages(conversation) }
                                    .onFailure { notify(it.message ?: "Delete failed") }
                            }
                        }
                    )
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(messageText, { messageText = it.take(2000) }, placeholder = { Text("Message...") }, modifier = Modifier.weight(1f), singleLine = true)
                Spacer(Modifier.width(8.dp))
                Button(onClick = {
                    val body = messageText.trim()
                    if (body.isNotEmpty()) scope.launch {
                        runCatching { repository.sendMessage(conversation.id, body) }
                            .onSuccess { messageText = ""; notify("Message sent"); loadMessages(conversation) }
                            .onFailure { notify(it.message ?: "Message failed") }
                    }
                }, colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("Send") }
            }
        }
        LaunchedEffect(conversation.id) { loadMessages(conversation) }
        return
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Header("Chats", "Messages, connections, and VibesMates") }
        item { OutlinedButton(onClick = { showVibeTap = true }, modifier = Modifier.fillMaxWidth()) { Text("📱 Vibe Tap · Connect phones together") } }
        if (requests.isNotEmpty()) {
            item { Text("Vibe requests", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
            items(requests, key = { it.id }) { request ->
                VibeRequestCard(
                    request = request,
                    openProfile = { openProfile(request.requester.id) },
                    accept = {
                        scope.launch {
                            runCatching { repository.acceptVibeRequest(request.id) }
                                .onSuccess { notify("VibesMate added. Your chat is ready."); loadConnections(); load() }
                                .onFailure { notify(it.message ?: "Could not accept") }
                        }
                    },
                    decline = {
                        scope.launch {
                            runCatching { repository.declineVibeRequest(request.id) }
                                .onSuccess { notify("Request declined"); loadConnections() }
                                .onFailure { notify(it.message ?: "Could not decline") }
                        }
                    },
                )
            }
        }
        if (mates.isNotEmpty()) {
            item { Text("VibesMates", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
            items(mates, key = { it.id }) { mate -> MateCard(mate) { openProfile(mate.id) } }
        }
        item { Text("Conversations", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
        if (loading) item { LoadingCard("Loading chats...") }
        else if (error != null) item { ErrorCard(error.orEmpty()) { load() } }
        else if (conversations.isEmpty()) item { EmptyCard("No chats yet", "When you match in Cupid, conversations appear here.") }
        else items(conversations, key = { it.id }) { chat -> ConversationCard(chat) { selectedConversation = chat } }
    }
}

@Composable
private fun ProfileScreen(session: SupabaseSession, repository: UnivCupidRepository, storage: SupabaseStorageClient, onSignOut: () -> Unit, openPhoto: (VibePost) -> Unit, openProfile: (String) -> Unit, notify: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var privacy by remember { mutableStateOf(PrivacySettings()) }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var showNotifications by rememberSaveable { mutableStateOf(false) }
    var notifications by remember { mutableStateOf<List<AppNotification>>(emptyList()) }
    var profile by remember { mutableStateOf<PublicProfile?>(null) }
    var uploadingAvatar by remember { mutableStateOf(false) }
    var myPosts by remember { mutableStateOf<List<VibePost>>(emptyList()) }
    var planRequests by remember { mutableStateOf<List<VibeJoinRequest>>(emptyList()) }
    var loadingPosts by remember { mutableStateOf(true) }
    var postsError by remember { mutableStateOf<String?>(null) }
    fun loadMyPosts() {
        scope.launch {
            loadingPosts = true
            runCatching { repository.loadMyVibes() }
                .onSuccess { myPosts = it; postsError = null }
                .onFailure { postsError = it.message }
            loadingPosts = false
        }
    }
    fun loadPlanRequests() {
        scope.launch {
            runCatching { repository.loadIncomingVibeJoinRequests() }.onSuccess { planRequests = it }
        }
    }
    fun loadProfile() {
        scope.launch {
            runCatching { repository.loadMyProfile() }
                .onSuccess { profile = it }
                .onFailure { notify(it.message ?: "Could not load profile") }
        }
    }
    fun loadNotifications() { scope.launch { runCatching { repository.loadNotifications() }.onSuccess { notifications = it }.onFailure { notify(it.message ?: "Could not load notifications") } } }
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted) notify("Location is optional. Enable it to receive nearby match alerts.")
        else {
            val manager = context.getSystemService(LocationManager::class.java)
            val location = runCatching { manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) ?: manager.getLastKnownLocation(LocationManager.GPS_PROVIDER) }.getOrNull()
            if (location == null) notify("Location unavailable. Turn on Location and try again.") else scope.launch { runCatching { repository.updateMyLocation(location.latitude, location.longitude) }.onSuccess { notify("Nearby Cupid alerts are on"); loadNotifications() }.onFailure { notify(it.message ?: "Could not update location") } }
        }
    }
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                uploadingAvatar = true
                runCatching {
                    val url = storage.uploadVibePhoto(context.contentResolver, uri, session.userId)
                    repository.updateProfileAvatar(url)
                    url
                }.onSuccess { url ->
                    profile = (profile ?: PublicProfile(session.userId, session.email.substringBefore("@"), 0, "", "", emptyList(), 100)).copy(avatarUrl = url)
                    notify("Profile photo updated")
                }.onFailure { notify(it.message ?: "Could not update profile photo") }
                uploadingAvatar = false
            }
        }
    }
    LaunchedEffect(Unit) { loadProfile(); loadMyPosts(); loadPlanRequests(); loadNotifications() }

    if (showNotifications) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { TextButton(onClick = { showNotifications = false }) { Text("‹ Back to You") }; Header("Notifications", "Your Vibes and Cupid activity") }
            item { OutlinedButton(onClick = { scope.launch { runCatching { repository.clearNotifications() }.onSuccess { notifications = emptyList(); notify("Notifications cleared") }.onFailure { notify(it.message ?: "Could not clear notifications") } } }, enabled = notifications.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text("Clear notifications") } }
            if (notifications.isEmpty()) item { EmptyCard("All caught up", "Reactions and nearby Cupid match alerts appear here.") }
            else items(notifications, key = { it.id }) { item -> Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(item.title, fontWeight = FontWeight.Bold); Text(item.body + if (item.count > 1) " · ${item.count} reactions" else "", color = Muted, fontSize = 12.sp) } } }
        }
        return
    }

    if (showSettings) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                TextButton(onClick = { showSettings = false }) { Text("‹ Back to You") }
                Header("Settings", "Privacy and account controls")
            }
            item { Text("Privacy", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
            item {
                SettingRow("Show university", privacy.showUniversity) { privacy = privacy.copy(showUniversity = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
                SettingRow("Show course", privacy.showCourse) { privacy = privacy.copy(showCourse = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
                SettingRow("Show age", privacy.showAge) { privacy = privacy.copy(showAge = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
                SettingRow("Allow DMs", privacy.allowDms) { privacy = privacy.copy(allowDms = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
                SettingRow("Appear in Cupid", privacy.appearInCupid) { privacy = privacy.copy(appearInCupid = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
                SettingRow("Appear in Vibe", privacy.appearInVibe) { privacy = privacy.copy(appearInVibe = it); scope.launch { repository.updatePrivacy(privacy) }; notify("Privacy updated") }
            }
            item { Button(onSignOut, colors = ButtonDefaults.buttonColors(containerColor = Ink), modifier = Modifier.fillMaxWidth()) { Text("Sign out") } }
        }
        return
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            val currentProfile = profile ?: PublicProfile(session.userId, session.email.substringBefore("@"), 0, "", "", emptyList(), 100)
            OwnProfileHeader(
                profile = currentProfile,
                postCount = myPosts.size,
                openPlanCount = planRequests.size,
                uploadingAvatar = uploadingAvatar,
                pickAvatar = { avatarPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                openSettings = { showSettings = true },
            )
        }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick = { showNotifications = true }, modifier = Modifier.weight(1f)) { Text("🔔 ${notifications.size}") }; OutlinedButton(onClick = { if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { val manager = context.getSystemService(LocationManager::class.java); val location = manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); if (location == null) notify("Turn on Location and try again.") else scope.launch { repository.updateMyLocation(location.latitude, location.longitude); notify("Nearby Cupid alerts are on") } } else locationPermission.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }, modifier = Modifier.weight(1f)) { Text("📍 Nearby Cupid") } } }
        item { Text("Your posts", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
        when {
            loadingPosts -> item { LoadingCard("Loading your Vibes...") }
            postsError != null -> item { ErrorCard(postsError.orEmpty()) { loadMyPosts() } }
            myPosts.isEmpty() -> item { EmptyCard("No posts yet", "Post a QuickShare with a photo and it will appear here.") }
            else -> items(myPosts, key = { it.id }) { post ->
                MyPostCard(
                    post = post,
                    openPhoto = openPhoto,
                    onDelete = {
                        scope.launch {
                            runCatching { repository.deleteMyVibe(post.id) }
                                .onSuccess { notify("Vibe deleted"); loadMyPosts() }
                                .onFailure { notify(it.message ?: "Delete failed") }
                        }
                    }
                )
                planRequests.filter { it.vibeId == post.id }.forEach { request ->
                    PlanJoinRequestCard(
                        request = request,
                        openProfile = { openProfile(request.requester.id) },
                        accept = {
                            scope.launch {
                                runCatching { repository.acceptVibeJoinRequest(request.id) }
                                    .onSuccess { notify("Plan accepted. Your chat is ready."); loadPlanRequests() }
                                    .onFailure { notify(it.message ?: "Could not accept") }
                            }
                        },
                        decline = {
                            scope.launch {
                                runCatching { repository.declineVibeJoinRequest(request.id) }
                                    .onSuccess { notify("Plan request declined"); loadPlanRequests() }
                                    .onFailure { notify(it.message ?: "Could not decline") }
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileDetailScreen(repository: UnivCupidRepository, profileUserId: String, onBack: () -> Unit, openPhoto: (VibePost) -> Unit, notify: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var detail by remember { mutableStateOf<ProfileDetail?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    fun load() {
        scope.launch {
            loading = true
            runCatching { repository.loadProfile(profileUserId) }
                .onSuccess { detail = it; error = null }
                .onFailure { error = it.message }
            loading = false
        }
    }
    LaunchedEffect(profileUserId) { load() }
    LazyColumn(Modifier.fillMaxSize().background(Paper), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { TextButton(onBack) { Text("‹ Back") } }
        when {
            loading -> item { LoadingCard("Loading profile...") }
            error != null -> item { ErrorCard(error.orEmpty()) { load() } }
            detail != null -> {
                val profileDetail = detail ?: return@LazyColumn
                item { ProfileHeaderCard(profileDetail.profile, profileDetail.vibesmateStatus) { scope.launch { runCatching { repository.sendVibeRequest(profileUserId) }.onSuccess { notify("Vibe sent"); load() }.onFailure { notify(it.message ?: "Could not send vibe") } } } }
                item { Text("Vibes", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
                if (profileDetail.posts.isEmpty()) item { EmptyCard("No visible Vibes", "VibesMate-only posts unlock after both students accept the vibe.") }
                else items(profileDetail.posts, key = { it.id }) { post -> MyPostCard(post, openPhoto, onDelete = {}) }
            }
        }
    }
}

@Composable private fun OwnProfileHeader(profile: PublicProfile, postCount: Int, openPlanCount: Int, uploadingAvatar: Boolean, pickAvatar: () -> Unit, openSettings: () -> Unit) { Surface(shape = RoundedCornerShape(24.dp), color = Color.White, shadowElevation = 3.dp, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { ProfileAvatar(profile, 88); Column(Modifier.weight(1f).padding(start = 14.dp)) { Text(profile.displayName.ifBlank { "Your profile" }, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink); Text(listOf(profile.university, profile.course).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Add your campus details" }, color = Muted, fontSize = 12.sp); TextButton(onClick = pickAvatar, enabled = !uploadingAvatar, contentPadding = PaddingValues(0.dp)) { Text(if (uploadingAvatar) "Uploading photo..." else "Change profile photo", color = Violet, fontWeight = FontWeight.Bold) } } }; Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) { ProfileStat(postCount.toString(), "Vibes"); ProfileStat(openPlanCount.toString(), "Open plans"); ProfileStat("♡", "Connections") }; OutlinedButton(onClick = openSettings, modifier = Modifier.fillMaxWidth()) { Text("Edit profile & privacy") } } } }

@Composable private fun ProfileStat(value: String, label: String) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(value, fontWeight = FontWeight.ExtraBold, color = Ink); Text(label, color = Muted, fontSize = 11.sp) } }

@Composable private fun ProfileHeaderCard(profile: PublicProfile, status: String, sendVibe: () -> Unit) { Surface(shape = RoundedCornerShape(24.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { ProfileAvatar(profile, 42); Column(Modifier.padding(start = 12.dp)) { Text(profile.displayName, fontSize = 24.sp, fontWeight = FontWeight.Bold); Text("${profile.university} · ${profile.course}", color = Muted, fontSize = 12.sp) } }; Surface(color = VioletLight, shape = RoundedCornerShape(12.dp)) { Text("$status · ${profile.commonVibePercent}% spark", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Violet, fontWeight = FontWeight.Bold, fontSize = 12.sp) }; if (status == "none" || status == "incoming") Button(sendVibe, colors = ButtonDefaults.buttonColors(containerColor = Coral), modifier = Modifier.fillMaxWidth()) { Text(if (status == "incoming") "Accept vibe" else "Send vibe") } else Text(if (status == "vibesmate") "You are VibesMates. Private posts are visible." else "Vibe request sent.", color = Muted, fontSize = 12.sp) } } }

@Composable private fun Header(title: String, subtitle: String) { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { LogoMark(); Column(Modifier.padding(start = 10.dp)) { Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Ink); Text(subtitle, color = Muted, fontSize = 12.sp) } } }

@Composable private fun VibePostCard(post: VibePost, openPhoto: (VibePost) -> Unit, openProfile: (String) -> Unit, onReport: () -> Unit, onJoinPlan: () -> Unit, react: (String) -> Unit) {
    Surface(shape = RoundedCornerShape(24.dp), color = Ink, shadowElevation = 6.dp, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.background(Brush.linearGradient(listOf(Color(0xFF8667B8), Ink))).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("✨ " + post.activity + if (post.visibility == "vibesmate") " · VibesMates" else "", color = Color(0xFFFFD0D9), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                TextButton(onClick = onReport, colors = ButtonDefaults.textButtonColors(contentColor = Color.White.copy(alpha = 0.75f))) {
                    Text("🚩 Report", fontSize = 11.sp)
                }
            }
            VibePhoto(post.mediaUrl, "Vibe photo", Modifier.fillMaxWidth().height(195.dp).clip(RoundedCornerShape(18.dp)).clickable { openPhoto(post) })
            Text("${post.author.displayName} · ${post.author.age}", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { openProfile(post.author.id) }.padding(top = 8.dp))
            Text("🎓 " + post.author.university + " · " + post.author.course, color = Color(0xFFE6E0F1), fontSize = 12.sp)
            if (post.caption.isNotBlank()) Text(post.caption, color = Color.White, modifier = Modifier.padding(top = 8.dp))
            if (post.openToCompany) {
                OutlinedButton(
                    onClick = onJoinPlan,
                    modifier = Modifier.padding(top = 10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = .65f)),
                ) { Text("🤝 Open to company · Request to join", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                listOf("❤️", "🔥", "🙌").forEach { Button({ react(it) }, colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = .22f)), shape = RoundedCornerShape(14.dp)) { Text(it, fontSize = 14.sp) } }
                Spacer(Modifier.weight(1f))
                Surface(color = Color.White.copy(alpha = 0.15f), shape = RoundedCornerShape(12.dp)) { Text("❤️ ${post.reactionCount}", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable private fun CircleCard(circle: CircleSummary, open: () -> Unit, action: (Boolean) -> Unit) { val scale by animateFloatAsState(if (circle.joined) 1.02f else 1f, animationSpec = spring(), label = "circleScale"); Surface(shape = RoundedCornerShape(18.dp), color = Color.White, shadowElevation = if (circle.joined) 5.dp else 2.dp, border = androidx.compose.foundation.BorderStroke(1.dp, if (circle.joined) Violet.copy(alpha = .45f) else Color(0xFFEEEAF8)), modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale }.clickable(onClick = open)) { Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(46.dp).clip(RoundedCornerShape(14.dp)).background(VioletLight), contentAlignment = Alignment.Center) { Text(circle.icon, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Violet) }; Column(Modifier.weight(1f).padding(start = 12.dp)) { Text(circle.name, fontWeight = FontWeight.Bold, fontSize = 14.sp); if (circle.description.isNotBlank()) Text(circle.description, color = Muted, fontSize = 12.sp, maxLines = 2); Text("${circle.campus.ifBlank { "Campus" }} · ${circle.activeCount} members", color = Mint, fontSize = 11.sp, fontWeight = FontWeight.SemiBold) }; Button({ action(circle.joined) }, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = if (circle.joined) Ink else Violet)) { Text(if (circle.joined) "Joined" else "Join +", fontWeight = FontWeight.Bold) } } } }

@Composable private fun CupidCard(person: PublicProfile, onReport: (() -> Unit)? = null) {
    val sparkColor = if (person.commonVibePercent >= 80) Coral else Violet
    Surface(
        shape = RoundedCornerShape(28.dp),
        color = Color.White,
        shadowElevation = 8.dp,
        border = androidx.compose.foundation.BorderStroke(1.5.dp, Brush.linearGradient(listOf(Color(0xFFFFD0D9), Color(0xFFF0ECFF)))),
        modifier = Modifier.fillMaxWidth().height(420.dp)
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(245.dp).background(Brush.verticalGradient(listOf(Color(0xFF8672B8), Ink))), contentAlignment = Alignment.Center) {
                Text(person.displayName.firstOrNull()?.toString() ?: "?", color = Color.White, fontSize = 84.sp, fontWeight = FontWeight.Bold)
                if (onReport != null) {
                    IconButton(onClick = onReport, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp)) {
                        Text("🚩", fontSize = 16.sp)
                    }
                }
                Surface(
                    color = Color.Black.copy(alpha = 0.45f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.align(Alignment.BottomStart).padding(12.dp)
                ) {
                    Text("📍 ${person.university}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${person.displayName}, ${person.age}", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Surface(
                        color = VioletLight,
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, sparkColor.copy(alpha = 0.4f))
                    ) {
                        Text("✦ ${person.commonVibePercent}% Spark", Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = sparkColor, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
                    }
                }
                Text("🎓 " + person.university + " · " + person.course, color = Muted, fontSize = 12.sp)
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LinearProgressIndicator(
                        progress = { (person.commonVibePercent / 100f).coerceIn(0f, 1f) },
                        modifier = Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)),
                        color = sparkColor,
                        trackColor = Color(0xFFEEEAF8)
                    )
                    Text("${person.commonVibePercent}% Match", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable private fun ConversationCard(chat: ConversationSummary, open: () -> Unit) { Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.clickable(onClick = open)) { Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Avatar(chat.title.firstOrNull()?.toString() ?: "C"); Column(Modifier.weight(1f).padding(start = 10.dp)) { Text(chat.title, fontWeight = FontWeight.Bold); Text(chat.lastMessage, color = Muted, fontSize = 12.sp) }; TextButton(open) { Text("Open") } } } }

@Composable private fun MessageBubble(message: ChatMessage, onDelete: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.isMine) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.CenterVertically) {
        if (message.isMine && onDelete != null) {
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Text("🗑️", fontSize = 12.sp)
            }
        }
        Surface(shape = RoundedCornerShape(18.dp), color = if (message.isMine) Violet else Color.White, shadowElevation = 1.dp, modifier = Modifier.widthIn(max = 280.dp)) {
            Text(message.body, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), color = if (message.isMine) Color.White else Ink, fontSize = 13.sp)
        }
    }
}

@Composable private fun CirclePostCard(post: CirclePost, canDelete: Boolean, react: (String) -> Unit, delete: () -> Unit) { Surface(shape = RoundedCornerShape(22.dp), color = Color.White, shadowElevation = 3.dp, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(post.author.displayName.firstOrNull()?.toString() ?: "U"); Column(Modifier.weight(1f).padding(start = 10.dp)) { Text(post.author.displayName, fontWeight = FontWeight.Bold); Text("${post.author.university} · ${post.minutesAgo}m ago", color = Muted, fontSize = 11.sp) }; if (canDelete) TextButton(onClick = delete, colors = ButtonDefaults.textButtonColors(contentColor = Coral)) { Text("Delete", fontSize = 11.sp, fontWeight = FontWeight.Bold) } }; if (post.prompt.isNotBlank()) Surface(color = VioletLight, shape = RoundedCornerShape(12.dp)) { Text(post.prompt, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = Violet, fontSize = 11.sp, fontWeight = FontWeight.Bold) }; Text(post.body, color = Ink, fontSize = 14.sp); VibePhoto(post.mediaUrl, "Circle post photo", Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(16.dp))); Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { listOf("Hype", "Same", "Game").forEach { Button({ react(it.lowercase()) }, colors = ButtonDefaults.buttonColors(containerColor = VioletLight, contentColor = Violet), shape = RoundedCornerShape(14.dp)) { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold) } }; Spacer(Modifier.weight(1f)); Text("${post.reactionCount} sparks", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold) } } } }

@Composable private fun MyPostCard(post: VibePost, openPhoto: (VibePost) -> Unit, onDelete: () -> Unit) {
    Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            VibePhoto(post.mediaUrl, "Your Vibe photo", Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(14.dp)).clickable { openPhoto(post) })
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(post.activity + if (post.visibility == "vibesmate") " · VibesMates only" else "", fontWeight = FontWeight.Bold)
                TextButton(onClick = onDelete, colors = ButtonDefaults.textButtonColors(contentColor = Coral)) {
                    Text("🗑️ Delete", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            if (post.caption.isNotBlank()) Text(post.caption, color = Muted, fontSize = 12.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun ReportDialog(
    targetName: String,
    onDismiss: () -> Unit,
    onSubmit: (reason: String, details: String) -> Unit
) {
    var reason by rememberSaveable { mutableStateOf("Inappropriate Content") }
    var details by rememberSaveable { mutableStateOf("") }
    val reasons = listOf("Inappropriate Content", "Harassment", "Spam", "Impersonation", "Campus Safety Concern")

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(22.dp), color = Color.White, modifier = Modifier.fillMaxWidth().padding(12.dp)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Report $targetName", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("Help keep the campus safe. Reports are immediately reviewed by Super Admin.", color = Muted, fontSize = 12.sp)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(reasons) { r ->
                        FilterChip(selected = reason == r, onClick = { reason = r }, label = { Text(r, fontSize = 11.sp) })
                    }
                }
                OutlinedTextField(
                    value = details,
                    onValueChange = { details = it.take(300) },
                    placeholder = { Text("Add specific details (optional)...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancel") }
                    Button(
                        onClick = { onSubmit(reason, details) },
                        colors = ButtonDefaults.buttonColors(containerColor = Coral),
                        modifier = Modifier.weight(1f)
                    ) { Text("Submit Report", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun CreateCircleSheet(onDismiss: () -> Unit, onCreate: (CircleDraft) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var icon by rememberSaveable { mutableStateOf("◌") }
    var description by rememberSaveable { mutableStateOf("") }
    var campus by rememberSaveable { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Paper) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Create Circle", fontSize = 26.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(name, { name = it.take(60) }, label = { Text("Circle name") }, placeholder = { Text("Campus Photowalk") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(icon, { icon = it.take(8) }, label = { Text("Icon") }, placeholder = { Text("CAM") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(campus, { campus = it.take(60) }, label = { Text("Campus") }, placeholder = { Text("CLSU") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(description, { description = it.take(180) }, label = { Text("Description") }, placeholder = { Text("What students do in this Circle") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            Button(
                onClick = { onCreate(CircleDraft(name = name, icon = icon, description = description, campus = campus)) },
                enabled = name.trim().length >= 3,
                colors = ButtonDefaults.buttonColors(containerColor = Coral),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
            ) { Text("Create and Join", fontWeight = FontWeight.Bold) }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun VibeTapSheet(repository: UnivCupidRepository, onDismiss: () -> Unit, notify: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scanner = remember {
        GmsBarcodeScanning.getClient(context, GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build())
    }
    LaunchedEffect(Unit) {
        runCatching { repository.createVibeTap() }
            .onSuccess { code = it; loading = false }
            .onFailure { notify(it.message ?: "Could not start Vibe Tap"); onDismiss() }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Paper) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Vibe Tap", fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Text("Keep phones together, then let the other person scan. This one-time code expires in 5 minutes.", color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
            if (loading) LoadingCard("Creating your Vibe Tap...") else code?.let { tapCode ->
                val image = remember(tapCode) { createQrImage("UNIVCUPID:TAP:$tapCode") }
                Image(image, contentDescription = "Vibe Tap QR code", modifier = Modifier.size(220.dp).background(Color.White).padding(10.dp))
                Text(tapCode, color = Violet, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            }
            Button(onClick = {
                scanner.startScan().addOnSuccessListener { barcode ->
                    val scanned = barcode.rawValue.orEmpty().removePrefix("UNIVCUPID:TAP:")
                    scope.launch {
                        runCatching { repository.claimVibeTap(scanned) }
                            .onSuccess { notify("VibesMate connected. Your chat is ready."); onDismiss() }
                            .onFailure { notify(it.message ?: "That Vibe Tap is unavailable") }
                    }
                }.addOnFailureListener { notify("Could not scan the Vibe Tap") }
            }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("Scan a Vibe Tap") }
            TextButton(onDismiss) { Text("Close") }
        }
    }
}

private fun createQrImage(value: String) = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 640, 640).let { matrix ->
    Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).apply {
        for (x in 0 until 640) for (y in 0 until 640) setPixel(x, y, if (matrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
    }.asImageBitmap()
}

@Composable private fun LoadingCard(text: String) { val shimmer by rememberInfiniteTransition(label = "loadingPulse").animateFloat(.72f, 1f, infiniteRepeatable(tween(850), RepeatMode.Reverse), label = "loadingAlpha"); Surface(shape = RoundedCornerShape(18.dp), color = VioletLight.copy(alpha = shimmer), modifier = Modifier.fillMaxWidth().graphicsLayer { scaleX = .99f + shimmer * .01f; scaleY = .99f + shimmer * .01f }) { Text(text, Modifier.padding(18.dp), color = Violet, fontWeight = FontWeight.Bold) } }
@Composable private fun EmptyCard(title: String, body: String) { Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(body, color = Muted, fontSize = 12.sp) } } }
@Composable private fun ErrorCard(text: String, retry: () -> Unit) { Surface(shape = RoundedCornerShape(18.dp), color = Color(0xFFFFF0F3), modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) { Text(text, color = Coral, fontWeight = FontWeight.Bold); TextButton(retry) { Text("Retry") } } } }
@Composable private fun AnimatedVisibilityToast(message: String?) { AnimatedVisibility(message != null, enter = fadeIn(tween(180)) + slideInVertically(tween(220)) { -it } + scaleIn(initialScale = .92f), exit = fadeOut(tween(140)) + slideOutVertically(tween(180)) { -it } + scaleOut(targetScale = .92f)) { Surface(shape = RoundedCornerShape(24.dp), color = Ink, shadowElevation = 8.dp, modifier = Modifier.padding(14.dp)) { Text(message.orEmpty(), Modifier.padding(horizontal = 16.dp, vertical = 10.dp), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) } } }
@Composable private fun Navigation(selected: Tab, onTab: (Tab) -> Unit) { NavigationBar(containerColor = Color.White) { Tab.entries.forEach { tab -> val scale by animateFloatAsState(if (selected == tab) 1.16f else 1f, animationSpec = spring(), label = "navScale"); NavigationBarItem(selected = selected == tab, onClick = { onTab(tab) }, icon = { Text(tab.icon, fontSize = 20.sp, modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale }) }, label = { Text(tab.label, fontSize = 9.sp) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = Violet, selectedTextColor = Violet, indicatorColor = VioletLight)) } } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun ShareSheet2(onDismiss: () -> Unit, onPublish: (QuickShareDraft) -> Unit) {
    var selected by rememberSaveable { mutableStateOf("☕ Coffee break") }
    var caption by rememberSaveable { mutableStateOf("") }
    var open by rememberSaveable { mutableStateOf(true) }
    var visibility by rememberSaveable { mutableStateOf("public") }
    var photoUri by rememberSaveable { mutableStateOf("") }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> photoUri = uri?.toString().orEmpty() }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Paper) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("QuickShare", fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Surface(shape = RoundedCornerShape(18.dp), color = VioletLight, modifier = Modifier.fillMaxWidth().height(180.dp).clickable { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                Box(contentAlignment = Alignment.Center) {
                    if (photoUri.isNotBlank()) AsyncImage(model = photoUri, contentDescription = "Selected photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    else Text("Tap to choose photo", color = Violet, fontWeight = FontWeight.Bold)
                }
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(listOf("☕ Coffee break", "✎ Study grind", "🎮 Gaming lounge", "🍜 Food trip", "🏋 Gym session")) { item -> FilterChip(selected == item, { selected = item }, { Text(item) }) } }
            OutlinedTextField(caption, { caption = it.take(280) }, placeholder = { Text("Say something optional...") }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text("Open to company", Modifier.weight(1f)); Switch(open, { open = it }) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { FilterChip(visibility == "public", { visibility = "public" }, { Text("Public") }); FilterChip(visibility == "vibesmate", { visibility = "vibesmate" }, { Text("VibesMates only") }) }
            Button({ onPublish(QuickShareDraft(activity = selected, caption = caption, openToCompany = open, visibility = visibility, localMediaUri = photoUri)) }, enabled = photoUri.isNotBlank(), modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Coral), shape = RoundedCornerShape(16.dp)) { Text("Publish Vibe", fontWeight = FontWeight.Bold) }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable private fun VibeRequestCard(request: VibeRequest, openProfile: () -> Unit, accept: () -> Unit, decline: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(request.id) { visible = true }
    AnimatedVisibility(visible, enter = fadeIn(tween(220)) + slideInVertically(tween(260)) { it / 3 } + scaleIn(initialScale = .94f), exit = fadeOut(tween(140)) + scaleOut(targetScale = .94f)) {
        Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth().clickable(onClick = openProfile)) {
            Column(Modifier.padding(14.dp)) {
                Text(request.requester.displayName, fontWeight = FontWeight.Bold)
                Text("${request.requester.university} · ${request.requester.course}", color = Muted, fontSize = 12.sp)
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(accept, colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("Accept") }
                    OutlinedButton(decline) { Text("Decline") }
                }
            }
        }
    }
}

@Composable private fun PlanJoinRequestCard(request: VibeJoinRequest, openProfile: () -> Unit, accept: () -> Unit, decline: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(request.id) { visible = true }
    AnimatedVisibility(visible, enter = fadeIn(tween(220)) + slideInVertically(tween(260)) { it / 3 } + scaleIn(initialScale = .94f), exit = fadeOut(tween(140)) + scaleOut(targetScale = .94f)) {
        Surface(shape = RoundedCornerShape(18.dp), color = VioletLight.copy(alpha = .58f), modifier = Modifier.fillMaxWidth().clickable(onClick = openProfile)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${request.requester.displayName} wants to join", fontWeight = FontWeight.Bold)
                Text("${request.activity} · ${request.caption.ifBlank { "Open Vibe" }}", color = Muted, fontSize = 12.sp, maxLines = 2)
                Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(accept, colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("Accept + Chat") }
                    OutlinedButton(decline) { Text("Decline") }
                }
            }
        }
    }
}

@Composable private fun MateCard(mate: PublicProfile, openProfile: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(mate.id) { visible = true }
    AnimatedVisibility(visible, enter = fadeIn(tween(260)) + slideInHorizontally(tween(280)) { it / 4 } + scaleIn(initialScale = .96f), exit = fadeOut(tween(140)) + scaleOut(targetScale = .96f)) {
        Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth().clickable(onClick = openProfile)) {
            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(mate.displayName.firstOrNull()?.toString() ?: "V")
                Column(Modifier.padding(start = 10.dp)) {
                    Text(mate.displayName, fontWeight = FontWeight.Bold)
                    Text("${mate.university} · ${mate.course}", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable private fun FullscreenPhoto(post: VibePost, onDismiss: () -> Unit) { Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) { Box(Modifier.fillMaxSize().background(Color.Black)) { VibePhoto(post.mediaUrl, "Full-size Vibe photo", Modifier.fillMaxSize().clickable(onClick = onDismiss)); Surface(color = Color.Black.copy(alpha = 0.62f), modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()) { Column(Modifier.padding(18.dp)) { Text(post.author.displayName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp); if (post.caption.isNotBlank()) Text(post.caption, color = Color.White, modifier = Modifier.padding(top = 6.dp)); TextButton(onDismiss) { Text("Close") } } } } } }

@Composable private fun VibePhoto(url: String, description: String, modifier: Modifier) {
    if (url.isBlank()) return
    val context = LocalContext.current
    val imageRequest = remember(url) {
        ImageRequest.Builder(context)
            .data(url)
            .crossfade(true)
            .size(1080, 1080)
            .allowHardware(true)
            .memoryCacheKey(url)
            .diskCacheKey(url)
            .build()
    }
    Box(modifier.background(Color.White.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
        AsyncImage(
            model = imageRequest,
            contentDescription = description,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable private fun SettingRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) { Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) { Text(label, Modifier.weight(1f), fontWeight = FontWeight.SemiBold); Switch(checked, onChange) } }
@Composable private fun Avatar(letter: String) { Surface(shape = CircleShape, color = Coral, modifier = Modifier.size(42.dp).border(2.dp, Violet, CircleShape)) { Box(contentAlignment = Alignment.Center) { Text(letter, color = Color.White, fontWeight = FontWeight.Bold) } } }
@Composable private fun ProfileAvatar(profile: PublicProfile, size: Int) { if (profile.avatarUrl.isBlank()) { Surface(shape = CircleShape, color = Coral, modifier = Modifier.size(size.dp).border(2.dp, Violet, CircleShape)) { Box(contentAlignment = Alignment.Center) { Text(profile.displayName.firstOrNull()?.toString() ?: "U", color = Color.White, fontSize = (size / 2).sp, fontWeight = FontWeight.Bold) } } } else { AsyncImage(model = profile.avatarUrl, contentDescription = "${profile.displayName} profile photo", contentScale = ContentScale.Crop, modifier = Modifier.size(size.dp).clip(CircleShape).border(2.dp, Violet, CircleShape)) } }
@Composable private fun LogoMark(size: Int = 42) { Image(painter = painterResource(R.drawable.logo), contentDescription = "UnivCupid logo", contentScale = ContentScale.Crop, modifier = Modifier.size(size.dp).clip(RoundedCornerShape(14.dp))) }
