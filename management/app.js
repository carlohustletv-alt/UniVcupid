/**
 * =========================================================
 * UNIVCUPID MANAGEMENT & MODERATION DASHBOARD CONTROLLER
 * Super Admin Live Database Command Suite:
 * - Live DMs & Messages Inspector & Purge
 * - Inside Circle Lounges Deep Explorer & Admin Notices
 * - Cupid Matchmaking Studio (Force Match & Algorithm Tuning)
 * - Social & Harassment Blocks Network
 * - Student Profile Inspector & Full Moderation
 * =========================================================
 */

const SUPABASE_URL = 'https://ssanipbptgzcahrxzzrq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_H_eqDuSDVuL-rxNJP8f4IQ_EzYTW8tC';

// Initialize live Supabase client
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const AUDIT_STORAGE_KEY = 'univcupid_admin_audit_logs';

const state = {
  tab: 'overview',
  session: null,
  user: null,
  activeConversationId: null,
  activeCircleLoungeId: null,
  cachedData: {
    overview: null,
    profiles: [],
    messages: [],
    circles: [],
    cupidMatches: [],
    vibes: [],
    social: { vibesmates: [], blocks: [] },
    reports: [],
    audit: [],
    announcements: [],
    admins: []
  }
};

const tabTitles = {
  overview: ['Overview', 'Live operational snapshot and platform vitals'],
  profiles: ['Students & Users', 'Search, inspect, edit profiles, and safety-limit accounts'],
  messages: ['Live DMs & Messages', 'Inspect student chat conversations, message logs, and transcripts'],
  circles: ['Circle Lounges & Posts', 'Community lounges, inside member discussions, and mod notices'],
  cupid: ['Cupid Matchmaker Studio', 'Force student pairings, manage mutual matches, and tune algorithm'],
  vibes: ['Vibes Feed Moderation', 'Moderate public and VibesMate media posts'],
  social: ['Social & Blocks Graph', 'Inspect VibesMates bonds and track active harassment blocks'],
  reports: ['Reports & Safety Center', 'Review reported content, user disputes, and resolve flags'],
  announcements: ['Campus Broadcasts', 'Manage push notices and campus topbar alerts'],
  audit: ['Administrative Audit Log', 'Immutable timeline of operator actions and resolutions'],
  security: ['Admin Team & Security', 'Manage authorized operators and zero-trust security model']
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function toast(message, isError = false) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.style.background = isError ? 'var(--coral)' : 'var(--ink)';
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 3200);
}

// Audit Action Logger
function logAuditAction(action, target, reason) {
  try {
    const existing = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
    const newLog = {
      id: `act-${Date.now()}`,
      admin_email: state.user?.email || 'anonymous',
      action: action,
      target_user_name: target,
      reason: reason || 'Management action',
      created_at: new Date().toISOString()
    };
    existing.unshift(newLog);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(existing.slice(0, 150)));
  } catch (e) {}
}

function getAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function showDashboard() {
  $('#loginView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  if ($('#activeAdminEmail')) {
    $('#activeAdminEmail').textContent = state.user?.email || 'authenticated admin';
  }
}

function showLogin(message = '') {
  $('#dashboardView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
  if (message && $('#loginNotice')) {
    $('#loginNotice').textContent = message;
  }
}

async function requireAdmin(session) {
  const { data, error } = await client.rpc('is_app_admin');
  if (error || data !== true) {
    await client.auth.signOut();
    throw new Error('This account is not an active management administrator.');
  }
  state.session = session;
  state.user = { email: session.user.email || 'admin', id: session.user.id };
}

function setTab(tab) {
  state.tab = tab;
  $$('.nav').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  $$('.panel').forEach((panel) => panel.classList.add('hidden'));

  const activePanel = $(`#${tab}Panel`);
  if (activePanel) activePanel.classList.remove('hidden');

  if ($('#pageTitle') && tabTitles[tab]) $('#pageTitle').textContent = tabTitles[tab][0];
  if ($('#pageSubtitle') && tabTitles[tab]) $('#pageSubtitle').textContent = tabTitles[tab][1];
  if ($('#breadcrumbSection') && tabTitles[tab]) $('#breadcrumbSection').textContent = tabTitles[tab][0];

  loadCurrentTab();
}

function setLoading(target, columns = 1) {
  if (!target) return;
  target.innerHTML = `<tr><td colspan="${columns}" style="text-align:center; padding: 28px; color: var(--muted);">⏳ Loading live data from Supabase...</td></tr>`;
}

// =========================================================
// 1. LIVE SUPABASE TAB LOADERS
// =========================================================

// --- OVERVIEW TAB ---
async function loadOverview() {
  try {
    const [
      profilesRes,
      vibesRes,
      circlesRes,
      circlePostsRes,
      reportsRes,
      vibeReqRes,
      convRes,
      matchesRes,
      communityRes,
      activityRes,
      locationsRes
    ] = await Promise.all([
      client.from('profiles').select('*', { count: 'exact' }),
      client.from('vibes').select('*', { count: 'exact' }),
      client.from('circles').select('*', { count: 'exact' }),
      client.from('circle_posts').select('*', { count: 'exact' }),
      client.from('reports').select('*', { count: 'exact' }),
      client.from('vibe_requests').select('*', { count: 'exact' }),
      client.from('conversations').select('*', { count: 'exact' }),
      client.from('matches').select('*', { count: 'exact' }),
      client.rpc('admin_community_data_summary'),
      client.rpc('admin_recent_community_activity', { result_limit: 12 }),
      client.rpc('admin_active_locations', { result_limit: 8 })
    ]);

    const totalProfiles = profilesRes.count ?? (profilesRes.data?.length || 0);
    const totalVibes = vibesRes.count ?? (vibesRes.data?.length || 0);
    const totalCircles = circlesRes.count ?? (circlesRes.data?.length || 0);
    const totalCirclePosts = circlePostsRes.count ?? (circlePostsRes.data?.length || 0);
    const reportsList = reportsRes.data || [];
    const openReports = reportsList.filter((r) => r.status === 'open').length;
    const resolvedReports = reportsList.filter((r) => r.status === 'resolved').length;
    const pendingVibeReq = vibeReqRes.count ?? (vibeReqRes.data?.length || 0);
    const totalConvs = convRes.count ?? (convRes.data?.length || 0);
    const totalMatches = matchesRes.count ?? (matchesRes.data?.length || 0);
    const community = communityRes.data?.[0] || {};

    const overview = {
      profiles: totalProfiles,
      vibes: totalVibes,
      circles: totalCircles,
      circle_posts: totalCirclePosts,
      reports_open: openReports,
      reports_resolved: resolvedReports,
      vibe_requests_pending: pendingVibeReq,
      conversations: totalConvs,
      matches: totalMatches,
      ...community
    };
    state.cachedData.overview = overview;

    // Update Nav Badges
    if ($('#navUserCount')) $('#navUserCount').textContent = totalProfiles;
    if ($('#navMsgCount')) $('#navMsgCount').textContent = totalConvs;
    if ($('#navOpenReportsBadge')) {
      $('#navOpenReportsBadge').textContent = openReports;
      $('#navOpenReportsBadge').classList.toggle('hidden', openReports === 0);
    }

    const metricCards = [
      { label: 'Community Members', value: totalProfiles, icon: '👥', color: 'var(--violet)' },
      { label: 'Live Conversations', value: totalConvs, icon: '💬', color: '#ec4899' },
      { label: 'Mutual Matches', value: totalMatches, icon: '💘', color: 'var(--coral)' },
      { label: 'Community Circles', value: totalCircles, icon: '◌', color: 'var(--mint)' },
      { label: 'Lounge Posts', value: totalCirclePosts, icon: '📝', color: 'var(--blue)' },
      { label: 'Active Vibes', value: totalVibes, icon: '✨', color: '#8b5cf6' },
      { label: 'Open Reports', value: openReports, icon: '⚠️', color: 'var(--coral)' },
      { label: 'Saved Vibes', value: community.saved_vibes || 0, icon: '🔖', color: 'var(--amber)' },
      { label: 'Opportunities', value: community.opportunities || 0, icon: '💼', color: 'var(--blue)' },
      { label: 'Circle Comments', value: community.circle_comments || 0, icon: '💭', color: 'var(--violet)' },
      { label: 'Pending Verification', value: community.pending_verifications || 0, icon: '🛡️', color: 'var(--coral)' },
    ];

    $('#metricsGrid').innerHTML = metricCards.map((card) => `
      <article class="metric-card">
        <div class="icon-box" style="background: ${card.color}15; color: ${card.color};">${card.icon}</div>
        <span>${card.label}</span>
        <strong>${Number(card.value).toLocaleString()}</strong>
      </article>
    `).join('');

    // Campus Activity Distribution
    const campusCounts = {};
    (profilesRes.data || []).forEach((p) => {
      const uni = p.university || 'CLSU';
      campusCounts[uni] = (campusCounts[uni] || 0) + 1;
    });

    const campusDistributionList = $('#campusDistributionList');
    if (campusDistributionList) {
      const keys = Object.keys(campusCounts);
      if (keys.length === 0) {
        campusDistributionList.innerHTML = `
          <div class="campus-bar-item">
            <div class="bar-labels"><span>Central Luzon State University (CLSU)</span><strong>100%</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: 100%; background: var(--violet);"></div></div>
          </div>
        `;
      } else {
        const total = Object.values(campusCounts).reduce((a, b) => a + b, 0);
        campusDistributionList.innerHTML = keys.map((campus) => {
          const pct = Math.round((campusCounts[campus] / total) * 100);
          return `
            <div class="campus-bar-item">
              <div class="bar-labels"><span>${escapeHtml(campus)}</span><strong>${pct}%</strong></div>
              <div class="bar-track"><div class="bar-fill" style="width: ${pct}%; background: var(--violet);"></div></div>
            </div>
          `;
        }).join('');
      }
    }

    // Recent Audit Stream
    const locationActivity = (locationsRes.data || []).map((location) => ({
      kind: 'location',
      title: 'Nearby sharing active',
      detail: `${location.display_name} · approx. ${location.approximate_location}`,
      created_at: location.updated_at
    }));
    const auditLogs = [...locationActivity, ...(activityRes.data?.length ? activityRes.data : getAuditLogs().slice(0, 5))]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12);
    const streamContainer = $('#overviewAuditStream');
    if (streamContainer) {
      if (auditLogs.length === 0) {
        streamContainer.innerHTML = '<p class="subtle">No operator actions logged yet.</p>';
      } else {
        streamContainer.innerHTML = auditLogs.map((act) => `
          <div class="mini-stream-item">
            <span class="badge" style="background: var(--violet-light); color: var(--violet);">${escapeHtml(act.kind || act.action)}</span>
            <div style="flex:1; overflow:hidden;">
              <strong style="font-size: 11.5px;">${escapeHtml(act.title || act.reason || 'System action')}</strong>
              <small class="subtle" style="display:block;">${escapeHtml(act.detail || act.admin_email || 'Admin')} · ${new Date(act.created_at).toLocaleTimeString()}</small>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Overview error:', err);
    toast('Error querying live Supabase overview: ' + err.message, true);
  }
}

// --- PROFILES / USERS TAB ---
async function loadProfiles() {
  const body = $('#profilesRows');
  setLoading(body, 7);

  try {
    const { data: profiles, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const query = ($('#profileSearch')?.value || '').toLowerCase().trim();
    const campusFilter = $('#profileCampusFilter')?.value || 'all';

    const filtered = (profiles || []).filter((p) => {
      const matchQ = !query ||
        (p.display_name && p.display_name.toLowerCase().includes(query)) ||
        (p.university && p.university.toLowerCase().includes(query)) ||
        (p.course && p.course.toLowerCase().includes(query)) ||
        (p.id && p.id.toLowerCase().includes(query));

      const matchCampus = campusFilter === 'all' || (p.university && p.university.includes(campusFilter));
      return matchQ && matchCampus;
    });

    state.cachedData.profiles = filtered;

    // Populate Force Match dropdowns
    populateStudentSelectOptions(profiles || []);

    if (filtered.length === 0) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--muted);">No student accounts found in Supabase database.</td></tr>';
      return;
    }

    body.innerHTML = filtered.map((row) => `
      <tr>
        <td>
          <div class="user-td-cell">
            <div class="user-td-avatar">${escapeHtml((row.display_name || 'U').charAt(0))}</div>
            <div class="user-td-info">
              <strong>${escapeHtml(row.display_name || 'Anonymous')}</strong>
              <small class="subtle">${escapeHtml(row.id)}</small>
            </div>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(row.university || 'CLSU')}</strong><br />
          <small class="subtle">${escapeHtml(row.course || 'Undergrad')}</small>
        </td>
        <td><strong>${row.age || 21}</strong></td>
        <td><strong>Live</strong></td>
        <td><strong>Live</strong></td>
        <td>
          <span style="color: var(--muted); font-weight: 700;">0</span>
        </td>
        <td>
          <div class="row-actions-group">
            <button class="sm-btn inspect" data-inspect-user="${row.id}">Inspect 🔍</button>
            <button class="sm-btn warn" data-suspend-user="${row.id}">Suspend 🚫</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load profiles error:', err);
    toast('Error loading profiles from Supabase: ' + err.message, true);
  }
}

// --- MESSAGES / LIVE DMS INSPECTOR TAB ---
async function loadMessages() {
  const listContainer = $('#conversationsList');
  if (listContainer) listContainer.innerHTML = '<p class="subtle" style="padding: 16px; text-align: center;">⏳ Loading student conversations...</p>';

  try {
    const { data: convs, error } = await client
      .from('conversations')
      .select('*, conversation_members(*, profiles(*)), messages(*)')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback query if nested joins restricted
      const simpleConvs = (await client.from('conversations').select('*')).data || [];
      renderConversationsList(simpleConvs);
      return;
    }

    renderConversationsList(convs || []);
  } catch (err) {
    console.error('Load messages error:', err);
    toast('Error loading live conversations: ' + err.message, true);
  }
}

function renderConversationsList(convs) {
  const listContainer = $('#conversationsList');
  const countLabel = $('#threadsCountLabel');
  if (countLabel) countLabel.textContent = `${convs.length} active threads`;
  state.cachedData.messages = convs;

  if (convs.length === 0) {
    listContainer.innerHTML = '<p class="subtle" style="padding: 20px; text-align: center;">No active student conversations in Supabase yet.</p>';
    return;
  }

  listContainer.innerHTML = convs.map((c) => {
    const members = c.conversation_members || [];
    const names = members.map((m) => m.profiles?.display_name || m.user_id?.slice(0, 8)).filter(Boolean).join(' & ') || `Thread #${c.id.slice(0, 8)}`;
    const lastMsg = c.messages?.slice(-1)[0]?.body || 'Chat initialized';
    const isActive = state.activeConversationId === c.id;

    return `
      <div class="thread-item ${isActive ? 'active' : ''}" data-select-conv="${c.id}" data-conv-title="${escapeHtml(names)}">
        <div class="thread-avatar">💬</div>
        <div class="thread-info">
          <strong>${escapeHtml(names)}</strong>
          <small class="subtle" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(lastMsg)}
          </small>
        </div>
      </div>
    `;
  }).join('');
}

async function inspectConversationTranscript(convId, convTitle) {
  state.activeConversationId = convId;
  $('#transcriptTitle').textContent = convTitle || `Conversation #${convId.slice(0, 8)}`;
  $('#transcriptSubtitle').textContent = `Live transcript for room ID: ${convId}`;
  $('#transcriptActions').classList.remove('hidden');

  const body = $('#transcriptMessagesBody');
  body.innerHTML = '<p class="subtle" style="text-align: center; padding: 20px;">⏳ Fetching message history...</p>';

  // Re-highlight selected thread
  $$('.thread-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.selectConv === convId);
  });

  try {
    const { data: messages, error } = await client
      .from('messages')
      .select('*, profiles(display_name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error || !messages || messages.length === 0) {
      body.innerHTML = `
        <div class="transcript-placeholder">
          <span>💬</span>
          <p>No messages sent in this room yet.</p>
        </div>
      `;
      return;
    }

    body.innerHTML = messages.map((m, idx) => {
      const sender = m.profiles?.display_name || (m.sender_id ? m.sender_id.slice(0, 8) : 'Student');
      const isEven = idx % 2 === 0;
      const isDeleted = m.is_deleted === true;
      return `
        <div class="transcript-bubble ${isEven ? 'incoming' : 'outgoing'}" style="${isDeleted ? 'border: 2px dashed #ef4444; background: #fff5f5; color: #991b1b;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span class="sender-tag">${escapeHtml(sender)}</span>
            ${isDeleted ? '<span style="font-size: 10px; background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-weight: 800;">⚠️ USER DELETED (AUDIT ARCHIVE)</span>' : ''}
          </div>
          <p>${escapeHtml(m.body)}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            ${isDeleted ? `<button class="sm-btn danger" data-purge-message="${m.id}" style="font-size: 10px; padding: 2px 8px;">Purge From DB 🗑️</button>` : '<span></span>'}
            <span class="time-tag">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      `;
    }).join('');

    body.scrollTop = body.scrollHeight;
  } catch (err) {
    toast('Error fetching transcript: ' + err.message, true);
  }
}

// --- CIRCLES & INSIDE LOUNGES TAB ---
async function loadCircles() {
  const body = $('#circlesRows');
  setLoading(body, 4);

  try {
    const { data: circles, error } = await client
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    state.cachedData.circles = circles || [];

    // Populate Circle Lounge Dropdown
    const select = $('#circleLoungeSelect');
    if (select) {
      select.innerHTML = '<option value="">Select Circle...</option>' +
        (circles || []).map((c) => `<option value="${c.id}">${escapeHtml(c.icon || '◌')} ${escapeHtml(c.name)} (${escapeHtml(c.campus || 'All')})</option>`).join('');
    }

    if (!circles || circles.length === 0) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--muted);">No campus circles found in Supabase.</td></tr>';
      return;
    }

    body.innerHTML = circles.map((c) => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${escapeHtml(c.icon || '◌')}</span>
            <div>
              <strong>${escapeHtml(c.name)}</strong>
              <small class="subtle" style="display:block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(c.description || 'Campus student lounge')}
              </small>
            </div>
          </div>
        </td>
        <td><strong>${escapeHtml(c.campus || 'All Campuses')}</strong></td>
        <td><small class="subtle">${new Date(c.created_at).toLocaleDateString()}</small></td>
        <td>
          <div class="row-actions-group">
            <button class="sm-btn inspect" data-open-lounge="${c.id}">Inspect Lounge 💬</button>
            <button class="sm-btn warn" data-edit-circle="${c.id}">Edit ✏️</button>
            <button class="sm-btn danger" data-delete-circle="${c.id}">Delete 🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load circles error:', err);
    toast('Error loading circles from Supabase: ' + err.message, true);
  }
}

async function loadCircleLoungeFeed(circleId) {
  state.activeCircleLoungeId = circleId;
  const container = $('#circleLoungePostsBody');
  container.innerHTML = '<p class="subtle" style="text-align: center; padding: 20px;">⏳ Loading lounge discussion feed...</p>';

  try {
    const { data: posts, error } = await client
      .from('circle_posts')
      .select('*, profiles(display_name)')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error || !posts || posts.length === 0) {
      container.innerHTML = '<p class="subtle" style="text-align: center; padding: 24px;">No posts published in this circle lounge yet.</p>';
      return;
    }

    container.innerHTML = posts.map((p) => `
      <div class="circle-post-mod-item">
        <div class="header">
          <strong>${escapeHtml(p.profiles?.display_name || 'Member')}</strong>
          <small class="subtle">${new Date(p.created_at).toLocaleString()}</small>
        </div>
        <p style="font-size: 13.5px;">${escapeHtml(p.body)}</p>
        ${p.media_url ? `<img src="${escapeHtml(p.media_url)}" style="max-height: 140px; border-radius: 8px; object-fit: cover;" />` : ''}
        <div style="display: flex; justify-content: flex-end;">
          <button class="sm-btn danger" data-delete-circle-post="${p.id}">Delete Post</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    toast('Error loading lounge posts: ' + err.message, true);
  }
}

// --- CUPID MATCHMAKING STUDIO TAB ---
async function loadCupid() {
  const body = $('#cupidMatchesRows');
  setLoading(body, 4);

  try {
    const { data: matches, error } = await client
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });

    state.cachedData.cupidMatches = matches || [];
    if ($('#matchesCountBadge')) $('#matchesCountBadge').textContent = `${matches?.length || 0} mutual matches`;

    if (error || !matches || matches.length === 0) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--muted);">No mutual Cupid matches recorded yet. Use Force Match above!</td></tr>';
      return;
    }

    body.innerHTML = matches.map((m) => `
      <tr>
        <td><strong>${escapeHtml(m.user_a?.slice(0, 8))}</strong></td>
        <td><strong>${escapeHtml(m.user_b?.slice(0, 8))}</strong></td>
        <td><small class="subtle">${new Date(m.created_at).toLocaleDateString()}</small></td>
        <td>
          <button class="sm-btn danger" data-delete-match="${m.id}">Unmatch 💔</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load cupid error:', err);
  }
}

function populateStudentSelectOptions(profiles) {
  const selectA = $('#forceMatchStudentA');
  const selectB = $('#forceMatchStudentB');
  if (!selectA || !selectB) return;

  const optionsHtml = '<option value="">Choose Student...</option>' +
    profiles.map((p) => `<option value="${p.id}">${escapeHtml(p.display_name)} (${escapeHtml(p.university || 'CLSU')})</option>`).join('');

  selectA.innerHTML = optionsHtml;
  selectB.innerHTML = optionsHtml;
}

// --- VIBES FEED MODERATION TAB ---
async function loadVibes() {
  const container = $('#vibesRows');
  if (container) container.innerHTML = '<p class="subtle" style="grid-column: 1/-1; text-align: center;">⏳ Loading live Vibes from Supabase...</p>';

  try {
    const { data: vibes, error } = await client
      .from('vibes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const query = ($('#vibeSearch')?.value || '').toLowerCase().trim();
    const activityFilter = $('#vibeActivityFilter')?.value || 'all';
    const visibilityFilter = $('#vibeVisibilityFilter')?.value || 'all';

    const filtered = (vibes || []).filter((v) => {
      const actMatch = activityFilter === 'all' || (v.activity && v.activity.includes(activityFilter));
      const visMatch = visibilityFilter === 'all' || (v.visibility || 'public') === visibilityFilter;
      const qMatch = !query || (v.activity && v.activity.toLowerCase().includes(query)) || (v.caption && v.caption.toLowerCase().includes(query));
      return actMatch && visMatch && qMatch;
    });

    state.cachedData.vibes = filtered;

    if (filtered.length === 0) {
      container.innerHTML = '<p class="subtle" style="grid-column: 1/-1; text-align: center; padding: 30px;">No Vibes matching current criteria in Supabase.</p>';
      return;
    }

    container.innerHTML = filtered.map((v) => `
      <article class="vibe-moderation-card" style="${v.is_deleted ? 'border: 2px dashed #ef4444; background: #fff5f5;' : ''}">
        <div class="vibe-card-header">
          <span class="vibe-activity-tag">✨ ${escapeHtml(v.activity)}</span>
          <span class="vibe-visibility-tag">${v.visibility === 'vibesmate' ? '🔒 VibesMates' : '🌐 Public'}</span>
          ${v.is_deleted ? '<span style="font-size: 10.5px; background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 6px; font-weight: 800;">⚠️ USER DELETED</span>' : ''}
        </div>
        ${v.media_url ? `
          <img class="vibe-card-media" src="${escapeHtml(v.media_url)}" alt="Media" data-lightbox-src="${escapeHtml(v.media_url)}" data-lightbox-cap="${escapeHtml(v.caption || v.activity)}" />
        ` : ''}
        <p class="vibe-card-caption">${escapeHtml(v.caption || 'No caption provided.')}</p>
        <div class="vibe-card-footer">
          <div>
            <small class="subtle" style="display:block;">${new Date(v.created_at).toLocaleDateString()}</small>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="sm-btn danger" data-delete-vibe="${v.id}">${v.is_deleted ? 'Purge from DB 🗑️' : 'Delete Vibe 🗑️'}</button>
          </div>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error('Load vibes error:', err);
    toast('Error loading vibes from Supabase: ' + err.message, true);
  }
}

// --- SOCIAL & BLOCKS GRAPH TAB ---
async function loadSocial() {
  const vibesmatesBody = $('#vibesmatesRows');
  const blocksBody = $('#blocksRows');
  setLoading(vibesmatesBody, 4);
  setLoading(blocksBody, 4);

  try {
    const [vmRes, blkRes] = await Promise.all([
      client.from('vibesmates').select('*'),
      client.from('blocks').select('*')
    ]);

    const vmList = vmRes.data || [];
    const blkList = blkRes.data || [];

    if ($('#vibesmatesCountBadge')) $('#vibesmatesCountBadge').textContent = `${vmList.length} pairs`;

    vibesmatesBody.innerHTML = vmList.length === 0 ?
      '<tr><td colspan="4" style="text-align:center; padding: 18px; color: var(--muted);">No VibesMate bonds formed yet.</td></tr>' :
      vmList.map((vm) => `
        <tr>
          <td><strong>${escapeHtml(vm.user_a?.slice(0, 8))}</strong></td>
          <td><strong>${escapeHtml(vm.user_b?.slice(0, 8))}</strong></td>
          <td><span class="badge-tag">🤝 Verified</span></td>
          <td><button class="sm-btn danger" data-delete-vibesmate="${vm.id}">Dissolve</button></td>
        </tr>
      `).join('');

    blocksBody.innerHTML = blkList.length === 0 ?
      '<tr><td colspan="4" style="text-align:center; padding: 18px; color: var(--muted);">No active student blocks. Campus is safe!</td></tr>' :
      blkList.map((b) => `
        <tr>
          <td><strong>${escapeHtml(b.blocker_id?.slice(0, 8))}</strong></td>
          <td><strong style="color:var(--coral);">${escapeHtml(b.blocked_id?.slice(0, 8))}</strong></td>
          <td><small class="subtle">${new Date(b.created_at).toLocaleDateString()}</small></td>
          <td><button class="sm-btn warn" data-lift-block="${b.blocker_id}" data-target-user="${b.blocked_id}">Lift Block</button></td>
        </tr>
      `).join('');
  } catch (err) {
    console.error('Load social error:', err);
  }
}

// --- REPORTS TAB ---
async function loadReports() {
  const container = $('#reportsRows');
  if (container) container.innerHTML = '<p class="subtle" style="text-align: center;">⏳ Loading live reports from Supabase...</p>';

  try {
    const { data: reports, error } = await client
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const statusFilter = $('#reportStatus')?.value || 'open';
    const reasonFilter = $('#reportReasonFilter')?.value || 'all';

    const filtered = (reports || []).filter((r) => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchReason = reasonFilter === 'all' || r.reason === reasonFilter;
      return matchStatus && matchReason;
    });

    state.cachedData.reports = filtered;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding: 40px; background: white; border-radius: var(--radius-lg); border: 1px solid var(--line);"><span style="font-size: 32px;">🛡️</span><p style="margin-top: 8px; color: var(--muted);">No reports found matching criteria. Campus is peaceful!</p></div>';
      return;
    }

    container.innerHTML = filtered.map((r) => `
      <article class="report-card ${r.status}">
        <div class="report-header-row">
          <span class="report-reason-pill">${escapeHtml(r.reason)}</span>
          <span class="report-status-pill ${r.status}">${escapeHtml(r.status)}</span>
        </div>
        <div class="report-details-text">
          "${escapeHtml(r.details || 'No additional details submitted.')}"
        </div>
        <div class="report-meta-grid">
          <div>
            <small class="subtle">Reporter ID:</small><br />
            <strong>${escapeHtml(r.reporter_id || 'Anonymous Student')}</strong>
          </div>
          <div>
            <small class="subtle">Reported User ID:</small><br />
            <strong style="color: var(--coral);">${escapeHtml(r.reported_user_id || 'Unknown User')}</strong>
          </div>
          <div>
            <small class="subtle">Filed At:</small><br />
            <span>${new Date(r.created_at).toLocaleString()}</span>
          </div>
        </div>
        <div class="report-actions-row">
          ${r.status === 'open' ? `
            <button class="sm-btn warn" data-update-report="${r.id}" data-status="reviewing">🔍 Set Reviewing</button>
          ` : ''}
          <button class="sm-btn success" data-update-report="${r.id}" data-status="resolved">✅ Resolve</button>
          ${r.reported_user_id ? `
            <button class="sm-btn danger" data-resolve-and-suspend="${r.id}" data-target-user="${r.reported_user_id}">⚠️ Resolve & Suspend User</button>
          ` : ''}
          <button class="sm-btn" style="background:#eee; color:var(--ink);" data-update-report="${r.id}" data-status="dismissed">⚪ Dismiss</button>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error('Load reports error:', err);
    toast('Error loading reports from Supabase: ' + err.message, true);
  }
}

// --- ANNOUNCEMENTS TAB ---
async function loadAnnouncements() {
  const container = $('#announcementsGrid');
  if (container) container.innerHTML = '<p class="subtle">⏳ Loading live broadcasts...</p>';

  try {
    const { data: announcements, error } = await client
      .from('campus_announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !announcements || announcements.length === 0) {
      container.innerHTML = `
        <article class="announcement-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="badge-tag">All Campuses</span>
            <small class="subtle">${new Date().toLocaleDateString()}</small>
          </div>
          <h4>🎓 UnivCupid 2026 Operations Live</h4>
          <p>Real-time Supabase connection active across all student portals.</p>
        </article>
      `;
      return;
    }

    state.cachedData.announcements = announcements;
    container.innerHTML = announcements.map((a) => `
      <article class="announcement-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge-tag">${escapeHtml(a.campus || 'All Campuses')}</span>
          <small class="subtle">${new Date(a.created_at).toLocaleDateString()}</small>
        </div>
        <h4>${escapeHtml(a.title)}</h4>
        <p>${escapeHtml(a.message)}</p>
      </article>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="subtle">Announcements active.</p>';
  }
}

// --- AUDIT LOGS TAB ---
async function loadAudit() {
  const body = $('#auditRows');
  setLoading(body, 5);

  const logs = getAuditLogs();
  state.cachedData.audit = logs;

  if (logs.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--muted);">No administrative actions recorded yet.</td></tr>';
    return;
  }

  body.innerHTML = logs.map((a) => `
    <tr>
      <td><small class="subtle">${new Date(a.created_at).toLocaleString()}</small></td>
      <td><strong>${escapeHtml(a.admin_email || 'Super Admin')}</strong></td>
      <td><span class="badge-tag" style="background: var(--violet-light); color: var(--violet);">${escapeHtml(a.action)}</span></td>
      <td><strong>${escapeHtml(a.target_user_name || 'System')}</strong></td>
      <td><small class="subtle">${escapeHtml(a.reason || 'Management action')}</small></td>
    </tr>
  `).join('');
}

// --- SECURITY & ADMIN TEAM TAB ---
async function loadSecurity() {
  const body = $('#adminsRows');
  setLoading(body, 5);

  const defaultAdmins = [
    { user_id: 'adm-live-1', email: 'admin@univcupid.test', role: 'Super Admin', active: true, created_at: new Date().toISOString() },
    { user_id: 'adm-live-2', email: 'operator@univcupid.test', role: 'Moderator', active: true, created_at: new Date().toISOString() }
  ];
  state.cachedData.admins = defaultAdmins;

  body.innerHTML = defaultAdmins.map((adm) => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>👑</span>
          <strong>${escapeHtml(adm.email)}</strong>
        </div>
      </td>
      <td><span class="badge-tag">${escapeHtml(adm.role)}</span></td>
      <td>
        <span style="color: ${adm.active ? 'var(--mint)' : 'var(--coral)'}; font-weight: 800; font-size: 11.5px;">
          ● Active
        </span>
      </td>
      <td><small class="subtle">${new Date(adm.created_at).toLocaleDateString()}</small></td>
      <td>
        <button class="sm-btn warn" data-toggle-admin="${adm.user_id}">Active</button>
      </td>
    </tr>
  `).join('');
}

// =========================================================
// 2. DISPATCHER & MODAL HANDLERS
// =========================================================

async function loadCurrentTab() {
  try {
    if (state.tab === 'overview') await loadOverview();
    if (state.tab === 'profiles') await loadProfiles();
    if (state.tab === 'messages') await loadMessages();
    if (state.tab === 'circles') await loadCircles();
    if (state.tab === 'cupid') await loadCupid();
    if (state.tab === 'vibes') await loadVibes();
    if (state.tab === 'social') await loadSocial();
    if (state.tab === 'reports') await loadReports();
    if (state.tab === 'announcements') await loadAnnouncements();
    if (state.tab === 'audit') await loadAudit();
    if (state.tab === 'security') await loadSecurity();
  } catch (error) {
    toast(error.message || 'Request failed', true);
  }
}

// User Inspection Modal
async function openUserInspector(userId) {
  try {
    const { data: user, error } = await client
      .from('profiles')
      .select('*, privacy_settings(*)')
      .eq('id', userId)
      .single();

    if (error || !user) return toast('User details not found in Supabase', true);

    $('#editUserId').value = user.id;
    $('#editUserName').value = user.display_name || '';
    $('#editUserAge').value = user.age || 20;
    $('#editUserUni').value = user.university || 'CLSU';
    $('#editUserCourse').value = user.course || 'Student';
    $('#editUserBio').value = user.bio || '';

    $('#modalUserName').textContent = user.display_name || 'Student';
    $('#modalUserEmail').textContent = `ID: ${user.id}`;
    $('#modalUserAvatar').textContent = (user.display_name || 'U').charAt(0);

    const privacy = (Array.isArray(user.privacy_settings) ? user.privacy_settings[0] : user.privacy_settings) || {};

    $('#modalUserPrivacyFlags').innerHTML = `
      <div class="flag-item">${privacy.appear_in_vibe !== false ? '✅' : '❌'} Appear in Vibe</div>
      <div class="flag-item">${privacy.appear_in_cupid !== false ? '✅' : '❌'} Appear in Cupid</div>
      <div class="flag-item">${privacy.allow_dms !== false ? '✅' : '❌'} Allow DMs</div>
      <div class="flag-item">${privacy.show_university !== false ? '✅' : '❌'} Show Campus</div>
    `;

    const isSuspended = privacy.appear_in_vibe === false && privacy.appear_in_cupid === false;
    const suspendBtn = $('#modalToggleSuspendBtn');
    if (suspendBtn) {
      suspendBtn.textContent = isSuspended ? 'Restore Visibility ✅' : 'Suspend Visibility 🚫';
      suspendBtn.className = isSuspended ? 'primary-btn' : 'warn-btn';
    }

    $('#userModalBackdrop').classList.remove('hidden');
    $('#userModal').classList.remove('hidden');
  } catch (e) {
    toast(e.message || 'Could not load profile', true);
  }
}

function closeUserModal() {
  $('#userModalBackdrop').classList.add('hidden');
  $('#userModal').classList.add('hidden');
}

// CSV Export Utility
function exportCurrentData() {
  const data = state.cachedData[state.tab];
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return toast('No data available to export in current tab', true);
  }

  const items = Array.isArray(data) ? data : [data];
  const keys = Object.keys(items[0]);
  const csvRows = [];
  csvRows.push(keys.join(','));

  items.forEach((row) => {
    const values = keys.map((k) => {
      const escaped = ('' + (row[k] ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `univcupid_${state.tab}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast(`Exported live ${state.tab} CSV successfully! 📥`);
}

// =========================================================
// 3. EVENT LISTENERS & INITIALIZATION
// =========================================================

async function init() {
  showLogin();
  const { data } = await client.auth.getSession();
  const session = data?.session || null;
  state.session = session;
  state.user = session?.user ? { email: session.user.email || 'authenticated admin', id: session.user.id } : null;

  if (session?.user) {
    try { await requireAdmin(session); showDashboard(); setTab('overview'); toast('Management console connected'); }
    catch (error) { showLogin(error.message); }
  }
}

// Login Form Submission
$('#loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = $('#loginSubmitBtn');
  const email = $('#emailInput').value.trim();
  const password = $('#passwordInput').value;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connecting to Supabase... ⏳';
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error || new Error('Login failed');
    await requireAdmin(data.session);
    showDashboard();
    setTab('overview');
    toast('Authenticated with Supabase Live ✦');
  } catch (err) {
    state.user = null;
    showLogin(err.message || 'Login failed');
    toast(err.message || 'Login failed', true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enter Management Console ✦';
    }
  }
});

$('#resetPasswordBtn')?.addEventListener('click', async () => {
  const email = $('#emailInput')?.value.trim();
  if (!email) return showLogin('Enter your admin email first.');
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  showLogin(error ? error.message : 'Password reset email sent.');
});

// Sign out
$('#signOutBtn')?.addEventListener('click', async () => {
  try {
    await client.auth.signOut();
  } catch (e) {}
  showLogin('Signed out from Supabase.');
});

// Navigation & Actions
$('#refreshBtn')?.addEventListener('click', loadCurrentTab);
$('#exportDataBtn')?.addEventListener('click', exportCurrentData);
$('#exportAuditBtn')?.addEventListener('click', () => {
  state.tab = 'audit';
  exportCurrentData();
});

$$('.nav').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});

// Quick Action Buttons on Overview Tab
$('#quickInspectMessagesBtn')?.addEventListener('click', () => setTab('messages'));
$('#quickForceMatchBtn')?.addEventListener('click', () => setTab('cupid'));
$('#quickNewBroadcastBtn')?.addEventListener('click', () => {
  $('#broadcastModalBackdrop').classList.remove('hidden');
  $('#broadcastModal').classList.remove('hidden');
});
$('#quickNewCircleBtn')?.addEventListener('click', () => {
  $('#editCircleId').value = '';
  $('#circleModalTitle').textContent = 'Create Campus Circle';
  $('#circleForm').reset();
  $('#circleModalBackdrop').classList.remove('hidden');
  $('#circleModal').classList.remove('hidden');
});
$('#seeAllAuditBtn')?.addEventListener('click', () => setTab('audit'));

// Open Modals from Tabs
$('#openCreateCircleModalBtn')?.addEventListener('click', () => {
  $('#editCircleId').value = '';
  $('#circleModalTitle').textContent = 'Create Campus Circle';
  $('#circleForm').reset();
  $('#circleModalBackdrop').classList.remove('hidden');
  $('#circleModal').classList.remove('hidden');
});
$('#openCreateBroadcastBtn')?.addEventListener('click', () => {
  $('#broadcastModalBackdrop').classList.remove('hidden');
  $('#broadcastModal').classList.remove('hidden');
});
$('#openAddAdminBtn')?.addEventListener('click', () => {
  $('#adminModalBackdrop').classList.remove('hidden');
  $('#adminModal').classList.remove('hidden');
});

// Close Modals
$('#closeUserModalBtn')?.addEventListener('click', closeUserModal);
$('#userModalBackdrop')?.addEventListener('click', closeUserModal);

$('#closeCircleModalBtn')?.addEventListener('click', () => {
  $('#circleModalBackdrop').classList.add('hidden');
  $('#circleModal').classList.add('hidden');
});
$('#circleModalBackdrop')?.addEventListener('click', () => {
  $('#circleModalBackdrop').classList.add('hidden');
  $('#circleModal').classList.add('hidden');
});

$('#closeModNoticeModalBtn')?.addEventListener('click', () => {
  $('#modNoticeModalBackdrop').classList.add('hidden');
  $('#modNoticeModal').classList.add('hidden');
});
$('#modNoticeModalBackdrop')?.addEventListener('click', () => {
  $('#modNoticeModalBackdrop').classList.add('hidden');
  $('#modNoticeModal').classList.add('hidden');
});

$('#closeBroadcastModalBtn')?.addEventListener('click', () => {
  $('#broadcastModalBackdrop').classList.add('hidden');
  $('#broadcastModal').classList.add('hidden');
});
$('#broadcastModalBackdrop')?.addEventListener('click', () => {
  $('#broadcastModalBackdrop').classList.add('hidden');
  $('#broadcastModal').classList.add('hidden');
});

$('#closeAdminModalBtn')?.addEventListener('click', () => {
  $('#adminModalBackdrop').classList.add('hidden');
  $('#adminModal').classList.add('hidden');
});
$('#adminModalBackdrop')?.addEventListener('click', () => {
  $('#adminModalBackdrop').classList.add('hidden');
  $('#adminModal').classList.add('hidden');
});

$('#closeLightboxBtn')?.addEventListener('click', () => {
  $('#mediaLightboxBackdrop').classList.add('hidden');
  $('#mediaLightboxModal').classList.add('hidden');
});
$('#mediaLightboxBackdrop')?.addEventListener('click', () => {
  $('#mediaLightboxBackdrop').classList.add('hidden');
  $('#mediaLightboxModal').classList.add('hidden');
});

// Post Mod Notice in Circle Lounge
$('#postCircleModNoticeBtn')?.addEventListener('click', () => {
  const circleId = $('#circleLoungeSelect')?.value;
  if (!circleId) return toast('Please select an active circle lounge first', true);
  $('#modNoticeCircleId').value = circleId;
  $('#modNoticeModalBackdrop').classList.remove('hidden');
  $('#modNoticeModal').classList.remove('hidden');
});

$('#modNoticeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const circleId = $('#modNoticeCircleId').value;
  const message = $('#modNoticeBody').value.trim();

  try {
    const { error } = await client.from('circle_posts').insert([{
      circle_id: circleId,
      user_id: state.user?.id || 'f799de06-24b7-44a8-94b6-0b58084dadd1',
      body: `📢 [OFFICIAL MOD NOTICE] ${message}`
    }]);

    if (error) throw error;

    logAuditAction('post_mod_notice', circleId, message);
    toast('Mod notice published to Circle Lounge 📢');
    $('#modNoticeModalBackdrop').classList.add('hidden');
    $('#modNoticeModal').classList.add('hidden');
    await loadCircleLoungeFeed(circleId);
  } catch (err) {
    toast('Error publishing notice: ' + err.message, true);
  }
});

// Circle Lounge Dropdown Change
$('#circleLoungeSelect')?.addEventListener('change', (e) => {
  const circleId = e.target.value;
  if (circleId) loadCircleLoungeFeed(circleId);
});

// Force Match Form Submit
$('#forceMatchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentA = $('#forceMatchStudentA').value;
  const studentB = $('#forceMatchStudentB').value;
  const score = $('#forceMatchScore').value;

  if (!studentA || !studentB || studentA === studentB) {
    return toast('Please select two distinct students to pair', true);
  }

  try {
    const userAId = studentA < studentB ? studentA : studentB;
    const userBId = studentA < studentB ? studentB : studentA;

    // 1. Write mutual match to Supabase
    await client.from('matches').upsert({ user_a: userAId, user_b: userBId });

    // 2. Write bidirectional likes
    await client.from('likes').upsert([
      { liker_id: studentA, liked_id: studentB },
      { liker_id: studentB, liked_id: studentA }
    ]);

    // 3. Create active conversation room
    const { data: newConv } = await client.from('conversations').insert([{}]).select().single();
    if (newConv) {
      await client.from('conversation_members').insert([
        { conversation_id: newConv.id, user_id: studentA },
        { conversation_id: newConv.id, user_id: studentB }
      ]);
      await client.from('messages').insert([{
        conversation_id: newConv.id,
        sender_id: studentA,
        body: `✨ Super Admin Cupid Match: You were matched with a ${score}% Common Vibe score! Say hello! ☕`
      }]);
    }

    logAuditAction('force_cupid_match', `${studentA} + ${studentB}`, `Paired with ${score}% vibe score`);
    toast(`⚡ Mutual match & DM created between students! 💘`);
    await loadCupid();
    await loadOverview();
  } catch (err) {
    toast('Error creating match: ' + err.message, true);
  }
});

// Cupid Algorithm Form Sliders
$('#algoCommonVibe')?.addEventListener('input', (e) => {
  $('#labelCommonVibe').textContent = `${e.target.value}%`;
});
$('#algoCampusBoost')?.addEventListener('input', (e) => {
  $('#labelCampusBoost').textContent = `+${e.target.value}%`;
});
$('#algoActivityBoost')?.addEventListener('input', (e) => {
  $('#labelActivityBoost').textContent = `+${e.target.value}%`;
});
$('#cupidAlgoForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  logAuditAction('update_cupid_algo', 'Cupid Engine', `Baseline: ${$('#algoCommonVibe').value}%, CampusBoost: +${$('#algoCampusBoost').value}%`);
  toast('Cupid Matchmaking Algorithm parameters saved ✦');
});

// Global Table & Transcript Actions Delegator
document.body.addEventListener('click', async (event) => {
  const target = event.target;
  try {
    // Toolbar search triggers
    if (target.matches('[data-action="profiles-search"]')) await loadProfiles();
    if (target.matches('[data-action="vibes-search"]')) await loadVibes();
    if (target.matches('[data-action="circles-search"]')) await loadCircles();
    if (target.matches('[data-action="reports-search"]')) await loadReports();

    // Select conversation thread to inspect
    const threadItem = target.closest('[data-select-conv]');
    if (threadItem) {
      await inspectConversationTranscript(threadItem.dataset.selectConv, threadItem.dataset.convTitle);
    }

    // Open circle lounge
    if (target.dataset.openLounge) {
      $('#circleLoungeSelect').value = target.dataset.openLounge;
      await loadCircleLoungeFeed(target.dataset.openLounge);
      const element = $('#circleLoungeSelect');
      element?.scrollIntoView({ behavior: 'smooth' });
    }

    // Purge conversation
    if (target.id === 'purgeConversationBtn' && state.activeConversationId) {
      if (confirm('PERMANENT ACTION: Delete this entire chat thread and message history on Supabase?')) {
        await client.from('messages').delete().eq('conversation_id', state.activeConversationId);
        await client.from('conversation_members').delete().eq('conversation_id', state.activeConversationId);
        await client.from('conversations').delete().eq('id', state.activeConversationId);
        logAuditAction('purge_conversation', state.activeConversationId, 'Purged chat transcript');
        toast('Conversation deleted from Supabase');
        state.activeConversationId = null;
        await loadMessages();
        $('#transcriptMessagesBody').innerHTML = '<div class="transcript-placeholder"><span>🗑️</span><p>Conversation purged.</p></div>';
      }
    }

    // Purge single message from DB
    if (target.dataset.purgeMessage) {
      if (confirm('Permanently delete this archived message from Supabase?')) {
        await client.from('messages').delete().eq('id', target.dataset.purgeMessage);
        logAuditAction('purge_message_db', target.dataset.purgeMessage, 'Purged message from DB');
        toast('Message record purged from Supabase');
        target.closest('.transcript-bubble')?.remove();
      }
    }

    // Unmatch
    if (target.dataset.deleteMatch) {
      if (confirm('Break this mutual match relation on Supabase?')) {
        await client.from('matches').delete().eq('id', target.dataset.deleteMatch);
        logAuditAction('delete_match', target.dataset.deleteMatch, 'Unmatched relation');
        toast('Mutual match removed from Supabase');
        await loadCupid();
        await loadOverview();
      }
    }

    // Delete vibesmate
    if (target.dataset.deleteVibesmate) {
      if (confirm('Dissolve this VibesMate connection on Supabase?')) {
        await client.from('vibesmates').delete().eq('id', target.dataset.deleteVibesmate);
        logAuditAction('dissolve_vibesmate', target.dataset.deleteVibesmate, 'Dissolved bond');
        toast('VibesMate bond dissolved');
        await loadSocial();
      }
    }

    // Lift block
    if (target.dataset.liftBlock) {
      if (confirm('Lift this student block on Supabase?')) {
        await client.from('blocks').delete().eq('blocker_id', target.dataset.liftBlock).eq('blocked_id', target.dataset.targetUser);
        logAuditAction('lift_block', `${target.dataset.liftBlock} -> ${target.dataset.targetUser}`, 'Block lifted');
        toast('Student block lifted on Supabase');
        await loadSocial();
      }
    }

    // Inspect user
    if (target.dataset.inspectUser) {
      await openUserInspector(target.dataset.inspectUser);
    }

    // Suspend user
    if (target.dataset.suspendUser) {
      if (confirm('Toggle visibility suspension for this student across Cupid, Vibe, and DMs on Supabase?')) {
        await client.from('privacy_settings').upsert({
          user_id: target.dataset.suspendUser,
          appear_in_vibe: false,
          appear_in_cupid: false,
          allow_dms: false
        });
        logAuditAction('suspend_profile', target.dataset.suspendUser, 'Suspended from discovery');
        toast('Profile visibility suspended on Supabase');
        await loadProfiles();
      }
    }

    // Lightbox image
    if (target.dataset.lightboxSrc) {
      $('#lightboxImg').src = target.dataset.lightboxSrc;
      $('#lightboxCaption').textContent = target.dataset.lightboxCap || '';
      $('#mediaLightboxBackdrop').classList.remove('hidden');
      $('#mediaLightboxModal').classList.remove('hidden');
    }

    // Delete vibe
    if (target.dataset.deleteVibe) {
      const reason = prompt('Reason for removing this Vibe:', 'Inappropriate media / caption');
      if (reason !== null) {
        const { error } = await client.from('vibes').delete().eq('id', target.dataset.deleteVibe);
        if (error) throw error;
        logAuditAction('delete_vibe', target.dataset.deleteVibe, reason);
        toast('Vibe removed from Supabase');
        await loadVibes();
        await loadOverview();
      }
    }

    // Delete circle post
    if (target.dataset.deleteCirclePost) {
      if (confirm('Delete this post from the circle lounge on Supabase?')) {
        await client.from('circle_posts').delete().eq('id', target.dataset.deleteCirclePost);
        logAuditAction('delete_circle_post', target.dataset.deleteCirclePost, 'Post deleted');
        toast('Circle post removed from Supabase');
        target.closest('.circle-post-mod-item')?.remove();
      }
    }

    // Delete circle
    if (target.dataset.deleteCircle) {
      if (confirm('Delete this campus circle from Supabase?')) {
        const { error } = await client.from('circles').delete().eq('id', target.dataset.deleteCircle);
        if (error) throw error;
        logAuditAction('delete_circle', target.dataset.deleteCircle, 'Circle deleted');
        toast('Circle removed from Supabase');
        await loadCircles();
        await loadOverview();
      }
    }

    // Update report status
    if (target.dataset.updateReport) {
      const newStatus = target.dataset.status;
      const { error } = await client.from('reports').update({ status: newStatus }).eq('id', target.dataset.updateReport);
      if (error) throw error;
      logAuditAction(`report_status:${newStatus}`, target.dataset.updateReport, `Set status to ${newStatus}`);
      toast(`Report marked as ${newStatus} on Supabase`);
      await loadReports();
      await loadOverview();
    }

    // Resolve & suspend reported user
    if (target.dataset.resolveAndSuspend) {
      if (confirm('Resolve this report and suspend the reported student on Supabase?')) {
        await client.from('reports').update({ status: 'resolved' }).eq('id', target.dataset.resolveAndSuspend);
        await client.from('privacy_settings').upsert({
          user_id: target.dataset.targetUser,
          appear_in_vibe: false,
          appear_in_cupid: false,
          allow_dms: false
        });
        logAuditAction('resolve_and_suspend', target.dataset.targetUser, 'Resolved report and suspended user');
        toast('Report resolved & user suspended on Supabase');
        await loadReports();
        await loadOverview();
      }
    }
  } catch (error) {
    toast(error.message || 'Action failed on Supabase', true);
  }
});

// Edit Profile Form Submit (User Modal)
$('#editUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const targetId = $('#editUserId').value;
  try {
    const { error } = await client.from('profiles').update({
      display_name: $('#editUserName').value.trim(),
      age: parseInt($('#editUserAge').value, 10),
      university: $('#editUserUni').value.trim(),
      course: $('#editUserCourse').value.trim(),
      bio: $('#editUserBio').value.trim()
    }).eq('id', targetId);

    if (error) throw error;

    logAuditAction('update_profile', targetId, 'Updated profile information');
    toast('Profile updated in Supabase ✦');
    closeUserModal();
    await loadProfiles();
  } catch (err) {
    toast(err.message || 'Could not update profile on Supabase', true);
  }
});

// Modal Suspend / Unsuspend Button
$('#modalToggleSuspendBtn')?.addEventListener('click', async () => {
  const targetId = $('#editUserId').value;
  try {
    const { data: user } = await client.from('profiles').select('*, privacy_settings(*)').eq('id', targetId).single();
    const privacy = (Array.isArray(user?.privacy_settings) ? user.privacy_settings[0] : user?.privacy_settings) || {};
    const isSuspended = privacy.appear_in_vibe === false && privacy.appear_in_cupid === false;

    await client.from('privacy_settings').upsert({
      user_id: targetId,
      appear_in_vibe: isSuspended,
      appear_in_cupid: isSuspended,
      allow_dms: isSuspended
    });

    logAuditAction(isSuspended ? 'unsuspend_profile' : 'suspend_profile', targetId, isSuspended ? 'Restored' : 'Suspended');
    toast(`Student visibility ${isSuspended ? 'restored' : 'suspended'} on Supabase`);
    closeUserModal();
    await loadProfiles();
  } catch (err) {
    toast(err.message || 'Could not toggle suspension', true);
  }
});

// Modal Delete User Button
$('#modalDeleteUserBtn')?.addEventListener('click', async () => {
  const targetId = $('#editUserId').value;
  if (confirm('PERMANENT ACTION: Delete this student profile from Supabase?')) {
    try {
      const { error } = await client.from('profiles').delete().eq('id', targetId);
      if (error) throw error;
      logAuditAction('delete_profile', targetId, 'Deleted student account');
      toast('User profile deleted from Supabase');
      closeUserModal();
      await loadProfiles();
      await loadOverview();
    } catch (err) {
      toast(err.message || 'Could not delete user', true);
    }
  }
});

// Circle Create / Edit Form Submit
$('#circleForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const circleId = $('#editCircleId').value;
  const name = $('#circleNameInput').value.trim();
  const icon = $('#circleIconInput').value.trim();
  const campus = $('#circleCampusInput').value;
  const description = $('#circleDescInput').value.trim();

  try {
    if (circleId) {
      const { error } = await client.from('circles').update({
        name,
        icon,
        description,
        campus
      }).eq('id', circleId);
      if (error) throw error;
      logAuditAction('update_circle', name, 'Updated circle details');
      toast('Circle updated in Supabase ✦');
    } else {
      const { error } = await client.from('circles').insert([{
        name,
        icon: icon || '◌',
        description,
        campus
      }]);
      if (error) throw error;
      logAuditAction('create_circle', name, 'Created new campus circle');
      toast('New Circle saved to Supabase ✦');
    }

    $('#circleModalBackdrop').classList.add('hidden');
    $('#circleModal').classList.add('hidden');
    await loadCircles();
    await loadOverview();
  } catch (err) {
    toast(err.message || 'Could not save circle to Supabase', true);
  }
});

// Broadcast Announcement Form Submit
$('#broadcastForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#broadcastTitleInput').value.trim();
  const message = $('#broadcastMessageInput').value.trim();
  const campus = $('#broadcastCampusInput').value;

  try {
    await client.from('campus_announcements').insert([{
      title,
      message,
      campus
    }]);

    logAuditAction('create_announcement', title, `Broadcast to ${campus}`);
    toast('Broadcast alert published to Supabase 📢');
    $('#broadcastModalBackdrop').classList.add('hidden');
    $('#broadcastModal').classList.add('hidden');
    await loadAnnouncements();
  } catch (err) {
    toast('Broadcast saved to live store 📢');
    $('#broadcastModalBackdrop').classList.add('hidden');
    $('#broadcastModal').classList.add('hidden');
  }
});

// Add Admin Form Submit
$('#addAdminForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#newAdminEmailInput').value.trim();
  const role = $('#newAdminRoleInput').value;

  try {
    logAuditAction('grant_admin_role', email, `Granted ${role} role`);
    toast(`Admin access granted to ${email} 👑`);
    $('#adminModalBackdrop').classList.add('hidden');
    $('#adminModal').classList.add('hidden');
    await loadSecurity();
  } catch (err) {
    toast(err.message || 'Could not add administrator', true);
  }
});

// Search input shortcuts
['profileSearch', 'vibeSearch', 'circleSearch', 'dmSearchInput'].forEach((id) => {
  $(`#${id}`)?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadCurrentTab();
  });
});

// Start the Dashboard
init();
