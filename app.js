document.addEventListener('DOMContentLoaded', () => {
  // Utility selectors
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  // =========================================================
  // 0. SUPABASE CONFIGURATION & AUTH API CLIENT
  // =========================================================
  const SUPABASE_CONFIG = {
    url: 'https://ssanipbptgzcahrxzzrq.supabase.co',
    anonKey: 'sb_publishable_H_eqDuSDVuL-rxNJP8f4IQ_EzYTW8tC'
  };

  const SESSION_STORAGE_KEY = 'univcupid_student_session';

  // Demo student profiles for Fast-Pass
  const FAST_PASS_STUDENTS = [
    {
      name: 'Carlo Santos',
      email: 'carlo.demo@univcupid.test',
      uni: 'CLSU',
      uniFullName: 'Central Luzon State University',
      course: 'B.S. Computer Science · Year 3',
      age: 21,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '☕',
      moodText: '"Caffeine powered & studying"',
      idNumber: 'PASS #2026-4920'
    },
    {
      name: 'Anna Reyes',
      email: 'anna.demo@univcupid.test',
      uni: 'CLSU',
      uniFullName: 'Central Luzon State University',
      course: 'B.S. Industrial Engineering · Year 3',
      age: 21,
      avatar: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '🎨',
      moodText: '"Working on drafting plates & listening to OPM"',
      idNumber: 'PASS #2026-3814'
    },
    {
      name: 'Mia Dela Cruz',
      email: 'mia.demo@univcupid.test',
      uni: 'UP Diliman',
      uniFullName: 'University of the Philippines Diliman',
      course: 'B.S. Architecture · Year 2',
      age: 20,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '📚',
      moodText: '"Tambay sa CS Lib, studying for design jury"',
      idNumber: 'PASS #2026-9102'
    },
    {
      name: 'Marcus Villanueva',
      email: 'marcus.demo@univcupid.test',
      uni: 'DLSU',
      uniFullName: 'De La Salle University Manila',
      course: 'B.S. Information Systems · Year 4',
      age: 23,
      avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '🎮',
      moodText: '"Need 1 sentinel for chill compe queue"',
      idNumber: 'PASS #2026-7281'
    },
    {
      name: 'Bea Mendoza',
      email: 'bea.demo@univcupid.test',
      uni: 'UST',
      uniFullName: 'University of Santo Tomas',
      course: 'B.S. Medical Technology · Year 1',
      age: 19,
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '🔬',
      moodText: '"Hematology finals review near España"',
      idNumber: 'PASS #2026-5519'
    },
    {
      name: 'Joshua Garcia',
      email: 'joshua.demo@univcupid.test',
      uni: 'Ateneo',
      uniFullName: 'Ateneo de Manila University',
      course: 'B.S. Management Engineering · Year 3',
      age: 22,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      moodEmoji: '🏀',
      moodText: '"Looking for 3 more for covered court pickup"',
      idNumber: 'PASS #2026-6643'
    }
  ];

  let currentUser = { ...FAST_PASS_STUDENTS[0] };

  // Supabase Auth HTTP Callers
  const supabaseSignUp = async (email, password, metadata) => {
    const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.anonKey
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
        data: metadata
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.msg || data.error_description || 'Signup failed on Supabase');
    }
    return data;
  };

  const supabaseSignIn = async (email, password) => {
    const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.anonKey
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.msg || data.error_description || 'Invalid campus credentials');
    }
    return data;
  };

  const supabaseEnsureProfile = async (token, profile) => {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/ensure-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          display_name: profile.name,
          age: profile.age || 21,
          university: profile.uni || 'CLSU',
          course: profile.course || 'Student'
        })
      });
      return await res.json();
    } catch (err) {
      console.warn('ensure-profile function notice:', err);
    }
  };

  // Hydrate user profile throughout the entire interface
  const hydrateUserProfile = (user) => {
    currentUser = { ...currentUser, ...user };

    // Topbar
    const topbarUserName = $('#topbarUserName');
    if (topbarUserName) topbarUserName.textContent = currentUser.name.split(' ')[0];
    const topbarAvatarImg = $('#topbarAvatarImg');
    if (topbarAvatarImg) topbarAvatarImg.src = currentUser.avatar;
    const topbarAvatarBadge = $('#topbarAvatarBadge');
    if (topbarAvatarBadge) topbarAvatarBadge.textContent = currentUser.moodEmoji;

    // Campus Time Tag
    const campusTimeDisplay = $('#campusTimeDisplay');
    if (campusTimeDisplay) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      campusTimeDisplay.textContent = `${currentUser.uni.toUpperCase()} CAMPUS • ${timeStr}`;
    }

    // You Tab (Passport Card)
    const youProfileAvatar = $('#youProfileAvatar');
    if (youProfileAvatar) youProfileAvatar.src = currentUser.avatar;
    const youProfileName = $('#youProfileName');
    if (youProfileName) youProfileName.textContent = `${currentUser.name}, ${currentUser.age || 21}`;
    const youProfileProgram = $('#youProfileProgram');
    if (youProfileProgram) youProfileProgram.textContent = currentUser.course;
    const youProfileUniChip = $('#youProfileUniChip');
    if (youProfileUniChip) youProfileUniChip.textContent = `🎓 ${currentUser.uni} VERIFIED`;
    const currentMoodEmoji = $('#currentMoodEmoji');
    if (currentMoodEmoji) currentMoodEmoji.textContent = currentUser.moodEmoji;
    const currentMoodText = $('#currentMoodText');
    if (currentMoodText) currentMoodText.textContent = currentUser.moodText;

    // Settings Modal
    const settingsProfileName = $('#settingsProfileName');
    if (settingsProfileName) settingsProfileName.textContent = currentUser.name;
    const settingsProfileUni = $('#settingsProfileUni');
    if (settingsProfileUni) settingsProfileUni.textContent = `${currentUser.idNumber || 'Student ID #2026-4920'} • ${currentUser.uni} Verified ✓`;

    // Persist session
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
    } catch (e) {}
  };

  // Web Audio Synthesizer for instant tactile & playful audio feedback
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playSound = (type) => {
    try {
      const settingMicroVibes = $('#settingMicroVibes');
      if (settingMicroVibes && !settingMicroVibes.checked) return;

      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'tap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'pop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'spark') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.06);
        osc.frequency.setValueAtTime(1174.66, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'match') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.07);
          g.gain.setValueAtTime(0.07, now + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          o.connect(g);
          g.connect(audioCtx.destination);
          o.start(now + i * 0.07);
          o.stop(now + 0.55);
        });
      } else if (type === 'whoosh') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'join') {
        [392, 523.25, 659.25].forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.06);
          g.gain.setValueAtTime(0.07, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          o.connect(g);
          g.connect(audioCtx.destination);
          o.start(now + i * 0.06);
          o.stop(now + 0.3);
        });
      }
    } catch (e) {}
  };

  // Sound/Vibe Toast Helper
  const toastPopup = $('#toastPopup');
  const toastText = $('#toastText');
  let toastTimer = null;

  const showToast = (message, icon = '✨') => {
    if (!toastPopup) return;
    toastPopup.querySelector('.toast-icon').textContent = icon;
    toastText.textContent = message;
    toastPopup.classList.add('show');
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastPopup.classList.remove('show');
    }, 2500);
  };

  // Floating Particle Generator
  const particlesContainer = $('#particlesContainer');
  const spawnParticles = (x, y, emojis = ['💖', '✨', '✦', '☕', '🌸']) => {
    if (!particlesContainer) return;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle-item';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 20;
      const tx = `${(Math.random() - 0.5) * 120}px`;
      const rot = `${(Math.random() - 0.5) * 60}deg`;

      particle.style.left = `${x + offsetX}px`;
      particle.style.top = `${y + offsetY}px`;
      particle.style.setProperty('--tx', tx);
      particle.style.setProperty('--rot', rot);
      particle.style.fontSize = `${14 + Math.random() * 12}px`;

      particlesContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 1200);
    }
  };

  // =========================================================
  // AUTH SCREEN CONTROLLERS & HOLOGRAPHIC CARD LOGIC
  // =========================================================
  const authScreen = $('#authScreen');
  const mainAppViewport = $('#mainAppViewport');
  const authModeTabs = $('#authModeTabs');
  const panels = {
    fastpass: $('#panelFastPass'),
    signup: $('#panelSignUp'),
    signin: $('#panelSignIn')
  };

  const holographicCard = $('#holographicCard');
  const previewStudentName = $('#previewStudentName');
  const previewStudentCourse = $('#previewStudentCourse');
  const previewStudentUni = $('#previewStudentUni');
  const previewUniBadge = $('#previewUniBadge');
  const previewAvatarImg = $('#previewAvatarImg');
  const previewMoodBadge = $('#previewMoodBadge');
  const previewStudentId = $('#previewStudentId');

  // Update Holographic Passport Live Preview
  const updateHolographicPreview = (data) => {
    if (data.name !== undefined && previewStudentName) previewStudentName.textContent = data.name || 'Your Name';
    if (data.course !== undefined && previewStudentCourse) previewStudentCourse.textContent = `${data.course} · Year ${data.year || 3}`;
    if (data.uni !== undefined && previewUniBadge) previewUniBadge.textContent = `🎓 ${data.uni}`;
    if (data.uniFullName !== undefined && previewStudentUni) previewStudentUni.textContent = data.uniFullName;
    if (data.avatar !== undefined && previewAvatarImg) previewAvatarImg.src = data.avatar;
    if (data.moodEmoji !== undefined && previewMoodBadge) previewMoodBadge.textContent = data.moodEmoji;
    if (data.idNumber !== undefined && previewStudentId) previewStudentId.textContent = data.idNumber;
  };

  // Holographic 3D Card interactive tilt
  if (holographicCard) {
    holographicCard.addEventListener('pointermove', (e) => {
      const rect = holographicCard.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rx = (-y / rect.height) * 14;
      const ry = (x / rect.width) * 14;
      holographicCard.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
    });

    holographicCard.addEventListener('pointerleave', () => {
      holographicCard.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
  }

  // Auth Mode Tabs switcher
  if (authModeTabs) {
    authModeTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.auth-tab-btn');
      if (!btn) return;
      $$('.auth-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      Object.keys(panels).forEach((k) => {
        if (panels[k]) {
          if (k === mode) panels[k].classList.add('active');
          else panels[k].classList.remove('active');
        }
      });
    });
  }

  // Fast-Pass Card selection
  let selectedFastPassStudent = FAST_PASS_STUDENTS[0];
  const fastPassGrid = $('#fastPassGrid');
  const fastPassSelectedName = $('#fastPassSelectedName');
  const fastPassLoginBtn = $('#fastPassLoginBtn');

  if (fastPassGrid) {
    fastPassGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.fast-pass-card');
      if (!card) return;
      $$('.fast-pass-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      const email = card.dataset.email;
      const student = FAST_PASS_STUDENTS.find((s) => s.email === email) || FAST_PASS_STUDENTS[0];
      selectedFastPassStudent = student;

      if (fastPassSelectedName) fastPassSelectedName.textContent = student.name.split(' ')[0];
      updateHolographicPreview(student);
    });
  }

  // Enter with Fast-Pass
  const enterApp = (user) => {
    hydrateUserProfile(user);
    if (authScreen) authScreen.classList.add('hidden');
    if (mainAppViewport) mainAppViewport.style.display = 'flex';

    spawnParticles(window.innerWidth / 2, window.innerHeight / 2, ['🎓', '✨', '💖', '✦', '⚡']);
    showToast(`Welcome to Campus, ${user.name.split(' ')[0]}! 🎓`, '✦');
  };

  if (fastPassLoginBtn) {
    fastPassLoginBtn.addEventListener('click', () => {
      enterApp(selectedFastPassStudent);
    });
  }

  // Sign Up Form: University Chips
  const signupUniChips = $('#signupUniChips');
  const signupUniInput = $('#signupUni');
  if (signupUniChips && signupUniInput) {
    signupUniChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.uni-chip');
      if (!btn) return;
      $$('.uni-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const uni = btn.dataset.uni;
      const uniName = btn.dataset.name;
      signupUniInput.value = uni;
      updateHolographicPreview({ uni, uniFullName: uniName });
    });
  }

  // Sign Up Form: Mood Chips
  let selectedSignupMood = { emoji: '☕', text: 'Caffeine powered & studying' };
  const signupMoodChips = $('#signupMoodChips');
  if (signupMoodChips) {
    signupMoodChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.mood-chip');
      if (!btn) return;
      $$('.mood-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      selectedSignupMood = { emoji: btn.dataset.emoji, text: btn.dataset.text };
      updateHolographicPreview({ moodEmoji: selectedSignupMood.emoji });
    });
  }

  // Sign Up Form: Live Input Preview Listeners
  const signupNameInput = $('#signupName');
  const signupCourseInput = $('#signupCourse');
  const signupAgeInput = $('#signupAge');

  if (signupNameInput) {
    signupNameInput.addEventListener('input', (e) => {
      updateHolographicPreview({ name: e.target.value || 'Your Name' });
    });
  }
  if (signupCourseInput) {
    signupCourseInput.addEventListener('input', (e) => {
      updateHolographicPreview({ course: e.target.value || 'Major / Degree' });
    });
  }

  // Sign Up Form Submission -> Real Supabase Connection!
  const signUpForm = $('#signUpForm');
  const submitSignUpBtn = $('#submitSignUpBtn');

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupNameInput ? signupNameInput.value.trim() : 'New Student';
      const email = $('#signupEmail').value.trim();
      const password = $('#signupPassword').value;
      const uni = signupUniInput ? signupUniInput.value : 'CLSU';
      const course = signupCourseInput ? signupCourseInput.value.trim() : 'Computer Science';
      const age = parseInt(signupAgeInput ? signupAgeInput.value : '21') || 21;

      if (!submitSignUpBtn) return;
      submitSignUpBtn.disabled = true;
      submitSignUpBtn.textContent = 'Issuing Passport on Supabase... ⏳';

      try {
        const metadata = {
          display_name: name,
          university: uni,
          course: course,
          age: age,
          vibe: selectedSignupMood.text
        };

        const signupRes = await supabaseSignUp(email, password, metadata);
        
        // If session token returned directly (auto-confirm or non-confirm mode)
        if (signupRes.access_token) {
          await supabaseEnsureProfile(signupRes.access_token, { name, age, uni, course });
        }

        const newStudentUser = {
          name: name,
          email: email,
          uni: uni,
          uniFullName: `${uni} Student`,
          course: `B.S. ${course} · Year 1`,
          age: age,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          moodEmoji: selectedSignupMood.emoji,
          moodText: `"${selectedSignupMood.text}"`,
          idNumber: `PASS #2026-${Math.floor(1000 + Math.random() * 9000)}`,
          token: signupRes.access_token || null,
          userId: signupRes.user ? signupRes.user.id : null
        };

        enterApp(newStudentUser);
        showToast('🎉 Campus Passport verified & connected to Supabase!', '🎓');
      } catch (err) {
        showToast(err.message || 'Could not connect to Supabase', '⚠️');
      } finally {
        submitSignUpBtn.disabled = false;
        submitSignUpBtn.textContent = 'Issue Passport & Connect to Supabase ✦';
      }
    });
  }

  // Sign In Form Submission -> Real Supabase Authentication!
  const signInForm = $('#signInForm');
  const submitSignInBtn = $('#submitSignInBtn');

  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#signinEmail').value.trim();
      const password = $('#signinPassword').value;

      if (!submitSignInBtn) return;
      submitSignInBtn.disabled = true;
      submitSignInBtn.textContent = 'Verifying credentials... ⏳';

      try {
        const signinRes = await supabaseSignIn(email, password);
        const userObj = signinRes.user || {};
        const meta = userObj.user_metadata || {};

        const loggedInUser = {
          name: meta.display_name || email.split('@')[0],
          email: email,
          uni: meta.university || 'CLSU',
          uniFullName: `${meta.university || 'CLSU'} Campus`,
          course: meta.course ? `B.S. ${meta.course}` : 'Student',
          age: meta.age || 21,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          moodEmoji: '⚡',
          moodText: '"Active on Campus"',
          idNumber: `PASS #2026-${Math.floor(1000 + Math.random() * 9000)}`,
          token: signinRes.access_token,
          userId: userObj.id
        };

        enterApp(loggedInUser);
      } catch (err) {
        // If demo credentials or email unconfirmed, give helpful guidance or fallback
        showToast(err.message || 'Authentication error', '⚠️');
      } finally {
        submitSignInBtn.disabled = false;
        submitSignInBtn.textContent = 'Sign In to Campus ✦';
      }
    });
  }

  // Sign Out Handler in Settings Modal
  const signOutBtn = $('#signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (settingsModal && settingsBackdrop) {
        settingsModal.classList.remove('open');
        settingsBackdrop.classList.remove('open');
      }
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {}

      if (mainAppViewport) mainAppViewport.style.display = 'none';
      if (authScreen) authScreen.classList.remove('hidden');

      showToast('Signed out. Choose your campus pass 🎓', '👋');
    });
  }

  // Check saved session on launch
  const checkInitialSession = () => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        hydrateUserProfile(parsed);
        if (authScreen) authScreen.classList.add('hidden');
        if (mainAppViewport) mainAppViewport.style.display = 'flex';
      } else {
        // Show Auth screen by default
        if (authScreen) authScreen.classList.remove('hidden');
        if (mainAppViewport) mainAppViewport.style.display = 'none';
        updateHolographicPreview(FAST_PASS_STUDENTS[0]);
      }
    } catch (e) {
      if (authScreen) authScreen.classList.remove('hidden');
    }
  };

  checkInitialSession();

  // =========================================================
  // 1. TAB NAVIGATION
  // =========================================================
  const navItems = $$('.nav-item');
  const screenViews = $$('.screen-view');

  const switchTab = (targetTabId) => {
    playSound('tap');
    screenViews.forEach((view) => {
      view.classList.remove('active');
    });

    const targetView = $(`#${targetTabId}`);
    if (targetView) {
      targetView.classList.add('active');
      targetView.classList.remove('spring-pop');
      void targetView.offsetWidth;
      targetView.classList.add('spring-pop');
      // Scroll to top of viewport
      const viewport = $('.screens-viewport');
      if (viewport) viewport.scrollTop = 0;
    }

    navItems.forEach((nav) => {
      if (nav.dataset.target === targetTabId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Control reels autoplay when switching tabs
    const reelVideo = $('#reelVideo');
    if (reelVideo) {
      if (targetTabId === 'tab-reels') {
        reelVideo.play().catch(() => {});
      } else {
        reelVideo.pause();
      }
    }
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      switchTab(target);
    });
  });

  // Top Avatar click -> Go to You tab
  const topAvatarBtn = $('#topAvatarBtn');
  if (topAvatarBtn) {
    topAvatarBtn.addEventListener('click', () => {
      switchTab('tab-you');
      showToast('Viewing your Campus Passport', '◉');
    });
  }

  // "See all" on match radar -> Go to Cupid tab
  const seeAllCupidBtn = $('#seeAllCupidBtn');
  if (seeAllCupidBtn) {
    seeAllCupidBtn.addEventListener('click', () => {
      switchTab('tab-cupid');
      showToast('Exploring Cupid Matches 💘', '♡');
    });
  }

  // =========================================================
  // 2. VIBE FEED & FILTERS
  // =========================================================
  const vibePills = $('#vibePills');
  if (vibePills) {
    vibePills.addEventListener('click', (e) => {
      const btn = e.target.closest('.vibe-pill');
      if (!btn) return;

      $$('.vibe-pill').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.vibe;
      const cards = $$('.moment-card');

      cards.forEach((card) => {
        const cat = card.dataset.category || '';
        if (filter === 'all' || cat.includes(filter)) {
          card.style.display = 'block';
          card.style.opacity = '1';
        } else {
          card.style.display = 'none';
        }
      });

      showToast(`Showing ${btn.textContent.trim()} around campus`, '✦');
    });
  }

  // Feed Actions: Reactions & Joins
  document.addEventListener('click', (e) => {
    // Like / React Button
    const reactBtn = e.target.closest('.react-btn');
    if (reactBtn) {
      const countEl = reactBtn.querySelector('.count');
      const isReacted = reactBtn.classList.contains('reacted');
      let count = parseInt(countEl.textContent, 10) || 0;

      const rect = reactBtn.getBoundingClientRect();
      const type = reactBtn.dataset.type || 'heart';
      const emojis = type === 'fire' ? ['🔥', '✨', '⚡'] : type === 'yum' ? ['😋', '🍜', '✨'] : ['💖', '♡', '✨'];

      if (!isReacted) {
        reactBtn.classList.add('reacted');
        countEl.textContent = count + 1;
        spawnParticles(rect.left + rect.width / 2, rect.top, emojis);
        showToast('Sent some campus love!', '💖');
      } else {
        reactBtn.classList.remove('reacted');
        countEl.textContent = Math.max(0, count - 1);
      }
      return;
    }

    // Join / I'm Down Button
    const joinBtn = e.target.closest('.join-btn');
    if (joinBtn) {
      const author = joinBtn.dataset.author || 'your classmate';
      const isJoined = joinBtn.classList.contains('joined');
      const rect = joinBtn.getBoundingClientRect();

      if (!isJoined) {
        joinBtn.classList.add('joined');
        joinBtn.innerHTML = '<span>✓</span> <b>You\'re in</b>';
        spawnParticles(rect.left + rect.width / 2, rect.top, ['🙌', '✨', '🎉', '☕']);
        showToast(`${author} knows you are down! 🎉`, '🙌');
      } else {
        joinBtn.classList.remove('joined');
        joinBtn.innerHTML = '<span>🙌</span> <b>I\'m down</b>';
      }
      return;
    }

    // Direct Message Button on Moment Card
    const chatDirectBtn = e.target.closest('.chat-direct-btn');
    if (chatDirectBtn) {
      const user = chatDirectBtn.dataset.user || 'Anna';
      openDirectChat(user);
      return;
    }

    // Circle Quick Join on Vibe Tab
    const circleQuickJoinBtn = e.target.closest('#circleQuickJoinBtn');
    if (circleQuickJoinBtn) {
      circleQuickJoinBtn.innerHTML = 'Joined <span>✓</span>';
      circleQuickJoinBtn.style.background = '#10b981';
      const rect = circleQuickJoinBtn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top, ['🎮', '✨', '👾']);
      showToast('Welcome to Gaming Club! 🎮', '👾');
      return;
    }

    // Person Card on Match Radar
    const personCard = e.target.closest('.person-card');
    if (personCard) {
      const personName = personCard.dataset.person || 'Mia';
      openDirectChat(personName);
      return;
    }
  });

  // =========================================================
  // 2.1 LIVE CAMPUS RADAR & DOUBLE-TAP MOMENT SPARKS
  // =========================================================
  const radarItems = $$('.radar-avatar-item');
  radarItems.forEach((item) => {
    item.addEventListener('click', () => {
      const name = item.dataset.name;
      const loc = item.dataset.location;
      const emoji = item.dataset.emoji;
      showToast(`${name} is active @ ${loc} ${emoji}!`, emoji);
      spawnParticles(window.innerWidth / 2, 100, [emoji, '✨', '📡', '👋']);

      // Smooth scroll to this author's card in the feed
      const targetCard = document.querySelector(`.moment-card[data-author-name="${name}"]`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.boxShadow = '0 0 20px rgba(109, 74, 255, 0.4)';
        setTimeout(() => {
          targetCard.style.boxShadow = '';
        }, 1600);
      }
    });
  });

  // Moment Photo Double-tap Heart Pop
  let lastMomentTap = 0;
  document.addEventListener('click', (e) => {
    const wrap = e.target.closest('.moment-card .card-image-wrap');
    if (!wrap) return;

    const now = Date.now();
    if (now - lastMomentTap < 300 && now - lastMomentTap > 0) {
      const burstHeart = wrap.querySelector('.moment-burst-heart');
      if (burstHeart) {
        burstHeart.classList.remove('pop');
        void burstHeart.offsetWidth;
        burstHeart.classList.add('pop');
        setTimeout(() => burstHeart.classList.remove('pop'), 500);
      }
      const card = wrap.closest('.moment-card');
      const reactBtn = card ? card.querySelector('.react-btn') : null;
      if (reactBtn) {
        const countEl = reactBtn.querySelector('.count');
        let count = parseInt(countEl.textContent, 10) || 0;
        reactBtn.classList.add('reacted');
        countEl.textContent = count + 1;
      }
      spawnParticles(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, ['💖', '🔥', '✨', '⚡']);
      showToast('Double-tap spark sent! 💖', '✨');
    }
    lastMomentTap = now;
  });

  // =========================================================
  // 3. CAMPUS REELS ENGINE
  // =========================================================
  const campusReels = [
    {
      id: 'reel-1',
      author: '@maya_premed',
      authorName: 'Maya',
      authorImg: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
      verifiedBadge: "🎓 Bio '24",
      location: '📍 Science Quad Garden',
      caption: "10 minutes before the organic chemistry finals... we're surviving on iced matcha and pure hope 😭📚 #CLSU #ExamWeek #FinalsVibe",
      sound: 'Lo-Fi Campus Study Radio • CLSU Chill Beats (Original Audio)',
      videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-group-of-friends-studying-in-a-library-4841-large.mp4',
      poster: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=85',
      likes: 1420,
      commentsCount: 86,
      isLiked: false,
      isFollowed: false,
      comments: [
        { user: 'Anna', avatar: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=100&q=80', text: 'LMAOO this is so painfully accurate for Chem 101 😭😭', time: '15m ago', likes: 14 },
        { user: 'Joshua', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80', text: 'Heading to 3rd floor library right now if anyone wants to study together! ☕', time: '8m ago', likes: 8 },
        { user: 'Marcus', avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=100&q=80', text: 'Iced matcha is the only thing keeping our GPA alive fr 😂', time: '2m ago', likes: 5 }
      ]
    },
    {
      id: 'reel-2',
      author: '@marcus_cs',
      authorName: 'Marcus',
      authorImg: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      verifiedBadge: "🎓 CS '25",
      location: '📍 Dorm Lounge B',
      caption: 'Mario Kart dorm championship grand finals! That last-second blue shell ruined friendships 🏁🎮 #DormLife #CLSU #Switch',
      sound: 'Mario Kart Quad Theme • Campus Esports Remix',
      videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-game-controller-playing-a-video-game-41611-large.mp4',
      poster: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=85',
      likes: 2180,
      commentsCount: 142,
      isLiked: true,
      isFollowed: true,
      comments: [
        { user: 'Bea', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80', text: 'I was in the lead until that shell I swear 😭', time: '30m ago', likes: 23 },
        { user: 'Carlo', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80', text: 'Rematch tonight at 8 PM in Lounge 3!', time: '12m ago', likes: 19 }
      ]
    },
    {
      id: 'reel-3',
      author: '@sophia_ba',
      authorName: 'Sophia',
      authorImg: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=200&q=80',
      verifiedBadge: "🎓 BA '23",
      location: '📍 West Campus Gate',
      caption: "POV: 11 PM boba & ramen run after a 4-hour group presentation meeting 🍜🧋 2 car seats open! #FoodTrip #CLSU",
      sound: 'Late Night Campus Drive • City Pop Vibes',
      videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-pouring-milk-in-a-glass-with-coffee-and-ice-42407-large.mp4',
      poster: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85',
      likes: 980,
      commentsCount: 47,
      isLiked: false,
      isFollowed: false,
      comments: [
        { user: 'Anna', avatar: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=100&q=80', text: 'Save me a brown sugar iced boba pls!! 🙏', time: '10m ago', likes: 11 }
      ]
    }
  ];

  let currentReelIndex = 0;
  let isAudioMuted = true;

  const reelVideo = $('#reelVideo');
  const reelAuthorImg = $('#reelAuthorImg');
  const reelAuthorName = $('#reelAuthorName');
  const reelLocation = $('#reelLocation');
  const reelCaption = $('#reelCaption');
  const reelSoundTitle = $('#reelSoundTitle');
  const reelLikeCount = $('#reelLikeCount');
  const reelCommentCount = $('#reelCommentCount');
  const reelLikeBtn = $('#reelLikeBtn');
  const reelHeartIcon = $('#reelHeartIcon');
  const reelFollowBtn = $('#reelFollowBtn');
  const reelPlayIndicator = $('#reelPlayIndicator');
  const reelBurstHeart = $('#reelBurstHeart');
  const reelsAudioBtn = $('#reelsAudioBtn');
  const reelsSoundIcon = $('#reelsSoundIcon');
  const reelProgressFill = $('#reelProgressFill');

  const renderReel = (index) => {
    const reel = campusReels[index % campusReels.length];
    if (!reel) return;

    if (reelAuthorImg) reelAuthorImg.src = reel.authorImg;
    if (reelAuthorName) reelAuthorName.textContent = reel.author;
    if (reelLocation) reelLocation.textContent = reel.location;
    if (reelCaption) reelCaption.textContent = reel.caption;
    if (reelSoundTitle) reelSoundTitle.textContent = reel.sound;
    if (reelLikeCount) reelLikeCount.textContent = reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes;
    if (reelCommentCount) reelCommentCount.textContent = reel.commentsCount;

    if (reelLikeBtn) {
      if (reel.isLiked) {
        reelLikeBtn.classList.add('liked');
        if (reelHeartIcon) reelHeartIcon.textContent = '❤️';
      } else {
        reelLikeBtn.classList.remove('liked');
        if (reelHeartIcon) reelHeartIcon.textContent = '♡';
      }
    }

    if (reelFollowBtn) {
      reelFollowBtn.textContent = reel.isFollowed ? '✓' : '+';
      reelFollowBtn.style.background = reel.isFollowed ? '#10b981' : '#ff5e7e';
    }

    if (reelVideo) {
      reelVideo.poster = reel.poster;
      const source = reelVideo.querySelector('source');
      if (source && source.src !== reel.videoSrc) {
        source.src = reel.videoSrc;
        reelVideo.load();
      }
      reelVideo.muted = isAudioMuted;
      const activeTab = $('.screen-view.active');
      if (activeTab && activeTab.id === 'tab-reels') {
        reelVideo.play().catch(() => {});
      }
    }

    renderReelsComments(reel.comments);
  };

  // Video Play/Pause & Double-tap Heart
  let lastTapTime = 0;
  const reelMediaWrapper = $('#reelMediaWrapper');
  if (reelMediaWrapper && reelVideo) {
    reelMediaWrapper.addEventListener('click', (e) => {
      const now = Date.now();
      const timeDiff = now - lastTapTime;

      if (timeDiff < 300 && timeDiff > 0) {
        // DOUBLE TAP -> Burst Heart
        const reel = campusReels[currentReelIndex % campusReels.length];
        if (!reel.isLiked) {
          reel.isLiked = true;
          reel.likes += 1;
          if (reelLikeCount) reelLikeCount.textContent = reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes;
          if (reelLikeBtn) reelLikeBtn.classList.add('liked');
          if (reelHeartIcon) reelHeartIcon.textContent = '❤️';
        }

        if (reelBurstHeart) {
          reelBurstHeart.classList.remove('pop');
          void reelBurstHeart.offsetWidth;
          reelBurstHeart.classList.add('pop');
        }

        spawnParticles(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, ['💖', '❤️', '✨', '⚡']);
        showToast(`Loved ${reel.author}'s reel! ❤️`, '💖');
      } else {
        // SINGLE TAP -> Toggle Play/Pause
        if (reelVideo.paused) {
          reelVideo.play();
          if (reelPlayIndicator) {
            reelPlayIndicator.textContent = '▶';
            reelPlayIndicator.classList.add('show');
            setTimeout(() => reelPlayIndicator.classList.remove('show'), 450);
          }
        } else {
          reelVideo.pause();
          if (reelPlayIndicator) {
            reelPlayIndicator.textContent = '⏸';
            reelPlayIndicator.classList.add('show');
            setTimeout(() => reelPlayIndicator.classList.remove('show'), 550);
          }
        }
      }
      lastTapTime = now;
    });
  }

  // Audio Toggle
  if (reelsAudioBtn && reelVideo) {
    reelsAudioBtn.addEventListener('click', () => {
      isAudioMuted = !isAudioMuted;
      reelVideo.muted = isAudioMuted;
      if (reelsSoundIcon) reelsSoundIcon.textContent = isAudioMuted ? '🔇' : '🔊';
      showToast(isAudioMuted ? 'Audio muted' : 'Audio playing 🎵', isAudioMuted ? '🔇' : '🔊');
    });
  }

  // Like Button Click
  if (reelLikeBtn) {
    reelLikeBtn.addEventListener('click', () => {
      const reel = campusReels[currentReelIndex % campusReels.length];
      reel.isLiked = !reel.isLiked;
      reel.likes += reel.isLiked ? 1 : -1;

      if (reel.isLiked) {
        reelLikeBtn.classList.add('liked');
        if (reelHeartIcon) reelHeartIcon.textContent = '❤️';
        const rect = reelLikeBtn.getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top, ['❤️', '💖', '✨']);
        showToast('Liked Reel ❤️', '❤️');
      } else {
        reelLikeBtn.classList.remove('liked');
        if (reelHeartIcon) reelHeartIcon.textContent = '♡';
      }

      if (reelLikeCount) reelLikeCount.textContent = reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes;
    });
  }

  // Follow Button
  if (reelFollowBtn) {
    reelFollowBtn.addEventListener('click', () => {
      const reel = campusReels[currentReelIndex % campusReels.length];
      reel.isFollowed = !reel.isFollowed;
      reelFollowBtn.textContent = reel.isFollowed ? '✓' : '+';
      reelFollowBtn.style.background = reel.isFollowed ? '#10b981' : '#ff5e7e';
      showToast(reel.isFollowed ? `Following ${reel.author} ✓` : `Unfollowed ${reel.author}`, '✦');
    });
  }

  // Drop In / Remix Reel
  const reelDropInBtn = $('#reelDropInBtn');
  if (reelDropInBtn) {
    reelDropInBtn.addEventListener('click', () => {
      const reel = campusReels[currentReelIndex % campusReels.length];
      openDirectChat(reel.authorName, reel.authorImg, `Hey ${reel.authorName}! Just saw your campus reel! 🙌`);
    });
  }

  // Share Reel Button
  const reelShareBtn = $('#reelShareBtn');
  if (reelShareBtn) {
    reelShareBtn.addEventListener('click', () => {
      const reel = campusReels[currentReelIndex % campusReels.length];
      showToast(`Link copied: univcupid.app/reels/${reel.id} ↗`, '🔗');
    });
  }

  // Previous & Next Reel Buttons
  const reelPrevBtn = $('#reelPrevBtn');
  const reelNextBtn = $('#reelNextBtn');

  if (reelPrevBtn) {
    reelPrevBtn.addEventListener('click', () => {
      playSound('whoosh');
      currentReelIndex = (currentReelIndex - 1 + campusReels.length) % campusReels.length;
      renderReel(currentReelIndex);
    });
  }

  if (reelNextBtn) {
    reelNextBtn.addEventListener('click', () => {
      playSound('whoosh');
      currentReelIndex = (currentReelIndex + 1) % campusReels.length;
      renderReel(currentReelIndex);
    });
  }

  // Vertical Swipe Gesture on Reels Deck
  const reelsDeck = $('#reelsDeck');
  if (reelsDeck) {
    let reelTouchStartY = 0;
    reelsDeck.addEventListener('touchstart', (e) => {
      reelTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    reelsDeck.addEventListener('touchend', (e) => {
      const diffY = e.changedTouches[0].clientY - reelTouchStartY;
      if (diffY < -50) {
        // Swipe Up -> Next Reel
        playSound('whoosh');
        currentReelIndex = (currentReelIndex + 1) % campusReels.length;
        renderReel(currentReelIndex);
      } else if (diffY > 50) {
        // Swipe Down -> Prev Reel
        playSound('whoosh');
        currentReelIndex = (currentReelIndex - 1 + campusReels.length) % campusReels.length;
        renderReel(currentReelIndex);
      }
    }, { passive: true });
  }

  // Music Notes Particle Fountain
  const spawnReelMusicNote = () => {
    const disc = $('#reelDisc');
    const reelsTab = $('#tab-reels');
    if (!disc || !reelsTab || !reelsTab.classList.contains('active')) return;
    const rect = disc.getBoundingClientRect();
    if (rect.width === 0) return;

    const note = document.createElement('div');
    note.className = 'music-note-particle';
    const notes = ['🎵', '🎶', '✨', '🎧', '💫'];
    note.textContent = notes[Math.floor(Math.random() * notes.length)];
    note.style.left = `${rect.left + rect.width / 2}px`;
    note.style.top = `${rect.top}px`;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2400);
  };

  setInterval(spawnReelMusicNote, 1600);

  // Create Reel button at top of Reels screen
  const reelsCreateBtn = $('#reelsCreateBtn');
  if (reelsCreateBtn) {
    reelsCreateBtn.addEventListener('click', () => {
      openShareSheet();
      const reelTypeTab = $('[data-type="reel"]');
      if (reelTypeTab) reelTypeTab.click();
    });
  }

  // Reels Comments Sheet Logic
  const reelCommentBtn = $('#reelCommentBtn');
  const reelsCommentsSheet = $('#reelsCommentsSheet');
  const reelsCommentsBackdrop = $('#reelsCommentsBackdrop');
  const closeReelsCommentsBtn = $('#closeReelsCommentsBtn');
  const reelsCommentsList = $('#reelsCommentsList');
  const commentsCountPill = $('#commentsCountPill');
  const newCommentInput = $('#newCommentInput');
  const sendCommentBtn = $('#sendCommentBtn');

  const renderReelsComments = (comments = []) => {
    if (!reelsCommentsList) return;
    if (commentsCountPill) commentsCountPill.textContent = `${comments.length} comments`;
    reelsCommentsList.innerHTML = comments.map((c) => `
      <div class="comment-item">
        <img src="${c.avatar}" alt="${c.user}" />
        <div class="comment-content">
          <div class="comment-author-row">
            <strong>${c.user}</strong>
            <small>${c.time}</small>
          </div>
          <p>${c.text}</p>
        </div>
        <button class="comment-heart-btn">♡ <b>${c.likes}</b></button>
      </div>
    `).join('');
  };

  const openCommentsSheet = () => {
    if (reelsCommentsSheet && reelsCommentsBackdrop) {
      const reel = campusReels[currentReelIndex % campusReels.length];
      renderReelsComments(reel.comments);
      reelsCommentsSheet.classList.add('open');
      reelsCommentsBackdrop.classList.add('open');
    }
  };

  const closeCommentsSheet = () => {
    if (reelsCommentsSheet && reelsCommentsBackdrop) {
      reelsCommentsSheet.classList.remove('open');
      reelsCommentsBackdrop.classList.remove('open');
    }
  };

  if (reelCommentBtn) reelCommentBtn.addEventListener('click', openCommentsSheet);
  if (closeReelsCommentsBtn) closeReelsCommentsBtn.addEventListener('click', closeCommentsSheet);
  if (reelsCommentsBackdrop) reelsCommentsBackdrop.addEventListener('click', closeCommentsSheet);

  const addReelComment = () => {
    if (!newCommentInput) return;
    const text = newCommentInput.value.trim();
    if (!text) return;

    const reel = campusReels[currentReelIndex % campusReels.length];
    reel.comments.push({
      user: 'Carlo (You)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      text: text,
      time: 'Just now',
      likes: 1
    });
    reel.commentsCount += 1;
    if (reelCommentCount) reelCommentCount.textContent = reel.commentsCount;

    renderReelsComments(reel.comments);
    newCommentInput.value = '';
    showToast('Comment posted! 💬', '✨');
  };

  if (sendCommentBtn) sendCommentBtn.addEventListener('click', addReelComment);
  if (newCommentInput) {
    newCommentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addReelComment();
    });
  }

  // Update reel progress bar
  if (reelVideo && reelProgressFill) {
    reelVideo.addEventListener('timeupdate', () => {
      if (reelVideo.duration) {
        const percent = (reelVideo.currentTime / reelVideo.duration) * 100;
        reelProgressFill.style.width = `${percent}%`;
      }
    });
  }

  // =========================================================
  // 4. CIRCLES & COMMUNITY LOUNGES
  // =========================================================
  const circleChips = $('#circleCategoryChips');
  if (circleChips) {
    circleChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.circle-filter-chip');
      if (!chip) return;

      $$('.circle-filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const cat = chip.dataset.cat;
      $$('.circle-card').forEach((card) => {
        if (cat === 'all' || card.dataset.cat === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Circle Community Chat Modal
  const circleChatModal = $('#circleChatModal');
  const circleChatBackdrop = $('#circleChatBackdrop');
  const closeCircleChatBtn = $('#closeCircleChatBtn');
  const circleChatTitle = $('#circleChatTitle');
  const circleChatIcon = $('#circleChatIcon');
  const circleChatMembers = $('#circleChatMembers');
  const circleChatMessages = $('#circleChatMessages');
  const circleMessageInput = $('#circleMessageInput');
  const sendCircleMessageBtn = $('#sendCircleMessageBtn');

  const openCircleLounge = (circleName) => {
    if (!circleChatModal || !circleChatBackdrop) return;
    const isGaming = circleName.includes('Gaming');
    const isCafe = circleName.includes('Cafe');

    if (circleChatTitle) circleChatTitle.textContent = circleName;
    if (circleChatIcon) circleChatIcon.textContent = isGaming ? '🎮' : isCafe ? '☕' : '📚';
    if (circleChatMembers) circleChatMembers.textContent = isGaming ? '42 students live in lounge' : isCafe ? '28 students live in lounge' : '64 students live in lounge';

    if (circleChatMessages) {
      if (isGaming) {
        circleChatMessages.innerHTML = `
          <div class="circle-msg-bubble">
            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=100&q=80" alt="Marcus" />
            <div class="circle-msg-content">
              <strong>Marcus <span>• CS '26</span></strong>
              <p>Lobby is up in Dorm Hall B! Mario Kart comp starts in 10 mins 🎮</p>
            </div>
          </div>
          <div class="circle-msg-bubble">
            <img src="https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=100&q=80" alt="Anna" />
            <div class="circle-msg-content">
              <strong>Anna <span>• IE '26</span></strong>
              <p>On my way! Bringing snacks from West Gate 🍿</p>
            </div>
          </div>
        `;
      } else if (isCafe) {
        circleChatMessages.innerHTML = `
          <div class="circle-msg-bubble">
            <img src="https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=100&q=80" alt="Anna" />
            <div class="circle-msg-content">
              <strong>Anna <span>• IE '26</span></strong>
              <p>Campus Brews just launched their seasonal brown sugar oat latte! 10/10 ☕✨</p>
            </div>
          </div>
          <div class="circle-msg-bubble">
            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80" alt="Joshua" />
            <div class="circle-msg-content">
              <strong>Joshua <span>• FA '25</span></strong>
              <p>Heading there right now with my sketchbook! 🙌</p>
            </div>
          </div>
        `;
      } else {
        circleChatMessages.innerHTML = `
          <div class="circle-msg-bubble">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="Mia" />
            <div class="circle-msg-content">
              <strong>Mia <span>• Bio '24</span></strong>
              <p>Library Floor 3 quiet corner is wide open if anyone wants to join the 2-hour Pomodoro grind! 📚</p>
            </div>
          </div>
        `;
      }
    }

    circleChatModal.classList.add('open');
    circleChatBackdrop.classList.add('open');
  };

  const closeCircleLounge = () => {
    if (circleChatModal && circleChatBackdrop) {
      circleChatModal.classList.remove('open');
      circleChatBackdrop.classList.remove('open');
    }
  };

  if (closeCircleChatBtn) closeCircleChatBtn.addEventListener('click', closeCircleLounge);
  if (circleChatBackdrop) circleChatBackdrop.addEventListener('click', closeCircleLounge);

  // Open lounge on click
  document.addEventListener('click', (e) => {
    const loungeBtn = e.target.closest('.circle-lounge-btn');
    if (loungeBtn) {
      const circleName = loungeBtn.dataset.circle || 'Campus Circle';
      openCircleLounge(circleName);
    }
  });

  const sendCircleMessage = () => {
    if (!circleMessageInput || !circleChatMessages) return;
    const text = circleMessageInput.value.trim();
    if (!text) return;

    const div = document.createElement('div');
    div.className = 'circle-msg-bubble';
    div.innerHTML = `
      <img src="${currentUser.avatar}" alt="${currentUser.name}" />
      <div class="circle-msg-content">
        <strong>${currentUser.name.split(' ')[0]} <span>• You</span></strong>
        <p>${text}</p>
      </div>
    `;
    circleChatMessages.appendChild(div);
    circleChatMessages.scrollTop = circleChatMessages.scrollHeight;
    circleMessageInput.value = '';
    showToast('Sent to Circle Lounge! 💬', '✨');
  };

  if (sendCircleMessageBtn) sendCircleMessageBtn.addEventListener('click', sendCircleMessage);
  if (circleMessageInput) {
    circleMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendCircleMessage();
    });
  }

  // Join/Leave Circle Toggle
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.circle-join-toggle-btn');
    if (btn) {
      const circleName = btn.dataset.circle || 'Circle';
      const isJoined = btn.classList.contains('joined');
      const rect = btn.getBoundingClientRect();

      if (!isJoined) {
        btn.classList.add('joined');
        btn.textContent = 'Joined ✓';
        spawnParticles(rect.left + rect.width / 2, rect.top, ['◌', '✨', '🎉']);
        showToast(`Joined ${circleName}`, '◌');
      } else {
        btn.classList.remove('joined');
        btn.textContent = 'Join +';
        showToast(`Left ${circleName}`, '👋');
      }
    }
  });

  const proposeCircleBtn = $('#proposeCircleBtn');
  if (proposeCircleBtn) {
    proposeCircleBtn.addEventListener('click', () => {
      showToast('Propose Circle flow opened! 💡', '✨');
    });
  }

  // =========================================================
  // 5. CUPID MATCHMAKER MULTI-PHOTO & SPARK QUIZ
  // =========================================================
  const cupidProfiles = [
    {
      name: 'Anna',
      age: 21,
      major: 'CLSU · Industrial Engineering',
      photos: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
      ],
      photoCaptions: ['Campus Brews ☕', 'Studio Sketching 🎨', 'Quad Walk 🌿'],
      score: '✦ 88% MUTUAL VIBE',
      sparkQuestion: 'Midnight study fuel?',
      vibes: ['☕ Specialty Coffee', '🎨 Sketching', '🎧 Indie Rock'],
      icebreaker: 'Iced latte on me? ☕',
      voiceText: '🎙️ 5s Voice Vibe • "Catch me at Campus Brews!"'
    },
    {
      name: 'Leo',
      age: 22,
      major: 'CLSU · Architecture',
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'
      ],
      photoCaptions: ['Design Studio 📐', 'Lagoon Sunset 🌅', '35mm Film 📸'],
      score: '✦ 92% MUTUAL VIBE',
      sparkQuestion: 'Best campus view?',
      vibes: ['🧗 Bouldering', '📸 35mm Film', '🍜 Night Ramen'],
      icebreaker: 'Show me that sunset spot? 🌅',
      voiceText: '🎙️ 4s Voice Vibe • "Engineering rooftop sunset is unreal"'
    },
    {
      name: 'Maya',
      age: 20,
      major: 'CLSU · Biology & Pre-Med',
      photos: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'
      ],
      photoCaptions: ['Bio Lab 🔬', 'Science Quad 🌿', 'Boba Time 🧋'],
      score: '✦ 85% MUTUAL VIBE',
      sparkQuestion: 'First campus date?',
      vibes: ['🌿 Plants', '🧋 Taro Boba', '📚 Study Sprints'],
      icebreaker: 'Crossword challenge accepted! 🧋',
      voiceText: '🎙️ 6s Voice Vibe • "Mini crosswords and iced boba! Let\'s go"'
    }
  ];

  let currentCupidIndex = 0;
  let currentPhotoSubIndex = 0;

  const renderCupidCard = (index) => {
    const profile = cupidProfiles[index % cupidProfiles.length];
    currentPhotoSubIndex = 0;

    const photo = $('#cupidPhoto');
    const nameAge = $('#cupidNameAge');
    const major = $('#cupidMajor');
    const score = $('#cupidScore');
    const vibes = $('#cupidVibes');
    const counter = $('#cupidPhotoCounter');
    const voiceText = $('.voice-text');

    if (photo) photo.src = profile.photos[0];
    if (nameAge) nameAge.textContent = `${profile.name}, ${profile.age}`;
    if (major) major.textContent = profile.major;
    if (score) score.textContent = profile.score;
    if (counter) counter.textContent = `📸 1 / ${profile.photos.length}`;
    if (voiceText) voiceText.textContent = profile.voiceText;

    // Reset progress segments
    const segments = $$('#cupidPhotoSegments .segment-bar');
    segments.forEach((seg, i) => {
      if (i === 0) seg.classList.add('active');
      else seg.classList.remove('active');
    });

    if (vibes) {
      vibes.innerHTML = profile.vibes.map((v) => `<span class="v-tag">${v}</span>`).join('');
    }

    // Reset quiz buttons
    $$('.spark-quiz-btn').forEach((btn) => btn.classList.remove('picked'));
  };

  // Tap left / right on Cupid Photo
  const cupidTapLeft = $('#cupidTapLeft');
  const cupidTapRight = $('#cupidTapRight');

  const cycleCupidPhoto = (direction) => {
    const profile = cupidProfiles[currentCupidIndex % cupidProfiles.length];
    if (direction === 'next') {
      currentPhotoSubIndex = (currentPhotoSubIndex + 1) % profile.photos.length;
    } else {
      currentPhotoSubIndex = (currentPhotoSubIndex - 1 + profile.photos.length) % profile.photos.length;
    }

    const photo = $('#cupidPhoto');
    const counter = $('#cupidPhotoCounter');
    if (photo) photo.src = profile.photos[currentPhotoSubIndex];
    if (counter) counter.textContent = `📸 ${currentPhotoSubIndex + 1} / ${profile.photos.length}`;

    const segments = $$('#cupidPhotoSegments .segment-bar');
    segments.forEach((seg, i) => {
      if (i === currentPhotoSubIndex) seg.classList.add('active');
      else seg.classList.remove('active');
    });
  };

  if (cupidTapLeft) cupidTapLeft.addEventListener('click', () => cycleCupidPhoto('prev'));
  if (cupidTapRight) cupidTapRight.addEventListener('click', () => cycleCupidPhoto('next'));

  // Spark Quiz Button Click
  document.addEventListener('click', (e) => {
    const quizBtn = e.target.closest('.spark-quiz-btn');
    if (quizBtn) {
      $$('.spark-quiz-btn').forEach((b) => b.classList.remove('picked'));
      quizBtn.classList.add('picked');
      const choice = quizBtn.textContent;
      const rect = quizBtn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top, ['⚡', '💖', '✨', '🧋']);
      showToast(`✦ 96% Compatibility Spark on ${choice}!`, '⚡');
    }
  });

  // Voice Vibe Play Simulation
  const voicePlayBtn = $('#voicePlayBtn');
  if (voicePlayBtn) {
    voicePlayBtn.addEventListener('click', () => {
      const waveform = $('.voice-waveform-animation');
      if (waveform) {
        waveform.classList.toggle('playing');
        voicePlayBtn.textContent = waveform.classList.contains('playing') ? '⏸' : '▶';
        if (waveform.classList.contains('playing')) {
          showToast('Playing campus voice note 🎙️', '🎵');
          setTimeout(() => {
            waveform.classList.remove('playing');
            voicePlayBtn.textContent = '▶';
          }, 5000);
        }
      }
    });
  }

  // Pass Button
  const cupidPassBtn = $('#cupidPassBtn');
  if (cupidPassBtn) {
    cupidPassBtn.addEventListener('click', () => {
      playSound('whoosh');
      const card = $('#cupidActiveCard');
      if (card) {
        card.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        card.style.transform = 'translateX(-100px) rotate(-14deg)';
        card.style.opacity = '0.3';
        setTimeout(() => {
          currentCupidIndex++;
          renderCupidCard(currentCupidIndex);
          card.style.transition = '';
          card.style.transform = 'none';
          card.style.opacity = '1';
        }, 250);
      }
      showToast('Passed for now 🌙', '🌙');
    });
  }

  // Super Spark Button
  const cupidSuperBtn = $('#cupidSuperBtn');
  if (cupidSuperBtn) {
    cupidSuperBtn.addEventListener('click', (e) => {
      playSound('spark');
      const rect = cupidSuperBtn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top, ['⚡', '✨', '💖', '🌟']);
      const profile = cupidProfiles[currentCupidIndex % cupidProfiles.length];
      showToast(`Super Spark sent to ${profile.name}! ⚡`, '⚡');

      const card = $('#cupidActiveCard');
      if (card) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'translateY(-120px) scale(0.95)';
        card.style.opacity = '0.2';
        setTimeout(() => {
          currentCupidIndex++;
          renderCupidCard(currentCupidIndex);
          card.style.transition = '';
          card.style.transform = 'none';
          card.style.opacity = '1';
        }, 300);
      }
    });
  }

  // Match Button (Crush / Interested)
  const cupidMatchBtn = $('#cupidMatchBtn');
  const cupidMatchModal = $('#cupidMatchModal');
  const matchedPersonName = $('#matchedPersonName');
  const matchedPersonLabel = $('#matchedPersonLabel');
  const matchedPersonAvatar = $('#matchedPersonAvatar');
  const matchStartChatBtn = $('#matchStartChatBtn');

  if (cupidMatchBtn && cupidMatchModal) {
    cupidMatchBtn.addEventListener('click', (e) => {
      playSound('match');
      const profile = cupidProfiles[currentCupidIndex % cupidProfiles.length];
      const rect = cupidMatchBtn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top, ['💘', '💖', '✨', '🌸', '🎉']);

      // Open Match Celebration Modal
      if (matchedPersonName) matchedPersonName.textContent = profile.name;
      if (matchedPersonLabel) matchedPersonLabel.textContent = profile.name;
      if (matchedPersonAvatar) matchedPersonAvatar.src = profile.photos[0];
      if (matchStartChatBtn) matchStartChatBtn.textContent = `Send Icebreaker: "${profile.icebreaker}"`;

      cupidMatchModal.classList.add('open');
    });
  }

  const matchKeepBrowsingBtn = $('#matchKeepBrowsingBtn');
  if (matchKeepBrowsingBtn) {
    matchKeepBrowsingBtn.addEventListener('click', () => {
      playSound('tap');
      cupidMatchModal.classList.remove('open');
      currentCupidIndex++;
      renderCupidCard(currentCupidIndex);
    });
  }

  if (matchStartChatBtn) {
    matchStartChatBtn.addEventListener('click', () => {
      playSound('spark');
      const profile = cupidProfiles[currentCupidIndex % cupidProfiles.length];
      cupidMatchModal.classList.remove('open');
      openDirectChat(profile.name, profile.photos[0], profile.icebreaker);
    });
  }

  // =========================================================
  // 5.1 CUPID DRAG & SWIPE GESTURE PHYSICS ENGINE
  // =========================================================
  const cupidCard = $('#cupidActiveCard');
  const stampLike = $('#stampLike');
  const stampNope = $('#stampNope');
  const stampSpark = $('#stampSpark');

  let isCupidDragging = false;
  let cupidStartX = 0;
  let cupidStartY = 0;
  let cupidCurrentX = 0;
  let cupidCurrentY = 0;

  if (cupidCard) {
    const onCupidPointerDown = (e) => {
      if (e.target.closest('.cupid-tap-left') || e.target.closest('.cupid-tap-right') || e.target.closest('button')) return;
      isCupidDragging = true;
      cupidStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      cupidStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      cupidCard.classList.add('dragging');
    };

    const onCupidPointerMove = (e) => {
      if (!isCupidDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      cupidCurrentX = clientX - cupidStartX;
      cupidCurrentY = clientY - cupidStartY;

      const rot = cupidCurrentX * 0.07;
      cupidCard.style.transform = `translate(${cupidCurrentX}px, ${cupidCurrentY}px) rotate(${rot}deg)`;

      // Stamp Opacities
      if (cupidCurrentX > 25) {
        const op = Math.min(1, (cupidCurrentX - 25) / 65);
        if (stampLike) stampLike.style.opacity = op;
        if (stampNope) stampNope.style.opacity = 0;
        if (stampSpark) stampSpark.style.opacity = 0;
      } else if (cupidCurrentX < -25) {
        const op = Math.min(1, (-cupidCurrentX - 25) / 65);
        if (stampNope) stampNope.style.opacity = op;
        if (stampLike) stampLike.style.opacity = 0;
        if (stampSpark) stampSpark.style.opacity = 0;
      } else if (cupidCurrentY < -30) {
        const op = Math.min(1, (-cupidCurrentY - 30) / 65);
        if (stampSpark) stampSpark.style.opacity = op;
        if (stampLike) stampLike.style.opacity = 0;
        if (stampNope) stampNope.style.opacity = 0;
      } else {
        if (stampLike) stampLike.style.opacity = 0;
        if (stampNope) stampNope.style.opacity = 0;
        if (stampSpark) stampSpark.style.opacity = 0;
      }
    };

    const onCupidPointerUp = () => {
      if (!isCupidDragging) return;
      isCupidDragging = false;
      cupidCard.classList.remove('dragging');
      if (stampLike) stampLike.style.opacity = 0;
      if (stampNope) stampNope.style.opacity = 0;
      if (stampSpark) stampSpark.style.opacity = 0;

      if (cupidCurrentX > 80) {
        // Swiped Right -> LIKE
        playSound('spark');
        cupidCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cupidCard.style.transform = 'translate(120%, 30px) rotate(22deg)';
        cupidCard.style.opacity = '0';
        setTimeout(() => {
          cupidCard.style.transition = '';
          cupidCard.style.transform = 'none';
          cupidCard.style.opacity = '1';
          if (cupidMatchBtn) cupidMatchBtn.click();
        }, 300);
      } else if (cupidCurrentX < -80) {
        // Swiped Left -> PASS
        playSound('whoosh');
        cupidCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cupidCard.style.transform = 'translate(-120%, 30px) rotate(-22deg)';
        cupidCard.style.opacity = '0';
        setTimeout(() => {
          cupidCard.style.transition = '';
          cupidCard.style.transform = 'none';
          cupidCard.style.opacity = '1';
          currentCupidIndex++;
          renderCupidCard(currentCupidIndex);
        }, 300);
      } else if (cupidCurrentY < -80) {
        // Swiped Up -> SUPER SPARK
        playSound('spark');
        cupidCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cupidCard.style.transform = 'translate(0, -120%) rotate(0deg)';
        cupidCard.style.opacity = '0';
        setTimeout(() => {
          cupidCard.style.transition = '';
          cupidCard.style.transform = 'none';
          cupidCard.style.opacity = '1';
          if (cupidSuperBtn) cupidSuperBtn.click();
        }, 300);
      } else {
        // Snap back
        cupidCard.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
        cupidCard.style.transform = 'translate(0, 0) rotate(0deg)';
        setTimeout(() => {
          cupidCard.style.transition = '';
        }, 250);
      }
      cupidCurrentX = 0;
      cupidCurrentY = 0;
    };

    cupidCard.addEventListener('mousedown', onCupidPointerDown);
    window.addEventListener('mousemove', onCupidPointerMove);
    window.addEventListener('mouseup', onCupidPointerUp);

    cupidCard.addEventListener('touchstart', onCupidPointerDown, { passive: true });
    window.addEventListener('touchmove', onCupidPointerMove, { passive: true });
    window.addEventListener('touchend', onCupidPointerUp);
  }

  // =========================================================
  // 6. CHATS SCREEN: STICKERS, VOICE, REACTIONS
  // =========================================================
  const chatsListView = $('#chatsListView');
  const chatRoomView = $('#chatRoomView');
  const backToChatsBtn = $('#backToChatsBtn');
  const roomName = $('#roomName');
  const roomAvatar = $('#roomAvatar');
  const roomStatus = $('#roomStatus');
  const chatMessagesContainer = $('#chatMessagesContainer');
  const chatMessageInput = $('#chatMessageInput');
  const chatSendBtn = $('#chatSendBtn');
  const chatStickerBtn = $('#chatStickerBtn');
  const chatStickerDrawer = $('#chatStickerDrawer');
  const closeStickerDrawerBtn = $('#closeStickerDrawerBtn');

  const openDirectChat = (name, avatar = null, initialMessage = null) => {
    switchTab('tab-chats');

    if (chatsListView) chatsListView.classList.add('hidden');
    if (chatRoomView) chatRoomView.classList.remove('hidden');

    if (roomName) roomName.textContent = name;
    if (roomStatus) roomStatus.textContent = 'Active now · 88% Match';

    if (roomAvatar) {
      if (avatar) {
        roomAvatar.src = avatar;
      } else if (name === 'Anna') {
        roomAvatar.src = 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=200&q=80';
      } else if (name === 'Joshua') {
        roomAvatar.src = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80';
      } else if (name === 'Mia') {
        roomAvatar.src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80';
      }
    }

    if (initialMessage && chatMessagesContainer) {
      sendOutgoingMessage(initialMessage);
    }
  };

  if (backToChatsBtn) {
    backToChatsBtn.addEventListener('click', () => {
      if (chatRoomView) chatRoomView.classList.add('hidden');
      if (chatsListView) chatsListView.classList.remove('hidden');
    });
  }

  // Click on any chat thread item to open room
  $$('.chat-thread-item').forEach((item) => {
    item.addEventListener('click', () => {
      const name = item.dataset.chatUser || 'Anna';
      const avatar = item.dataset.chatAvatar || '';
      openDirectChat(name, avatar);
    });
  });

  // Daily Icebreaker Banner button
  const useIcebreakerTopBtn = $('#useIcebreakerTopBtn');
  if (useIcebreakerTopBtn) {
    useIcebreakerTopBtn.addEventListener('click', () => {
      openDirectChat('Anna', null, '💡 Daily Icebreaker: Rank the top 3 study spots on campus from best to worst!');
    });
  }

  const sendOutgoingMessage = (text) => {
    if (!text || !text.trim() || !chatMessagesContainer) return;
    playSound('pop');

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message-bubble outgoing';
    msgDiv.innerHTML = `<p>${text.trim()}</p><span class="msg-time">${timeString}</span>`;

    chatMessagesContainer.appendChild(msgDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    // Show live animated typing indicator
    const typingBubble = $('#chatTypingBubble');
    if (typingBubble) {
      typingBubble.classList.remove('hidden');
      chatMessagesContainer.appendChild(typingBubble);
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // Trigger simulated reply after a brief pause
    setTimeout(() => {
      if (typingBubble) typingBubble.classList.add('hidden');
      playSound('spark');

      const replyDiv = document.createElement('div');
      replyDiv.className = 'message-bubble incoming';
      const replies = [
        'Haha yesss totally! Let\'s meet up right after class 🙌',
        'Omg perfect timing! I\'m grabbing a seat now ☕✨',
        'Haha that made my day! Saving you a spot at the table ✦',
        'Count me in! See you in 5 minutes 😊'
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      replyDiv.innerHTML = `<p>${randomReply}</p><span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
      chatMessagesContainer.appendChild(replyDiv);
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      showToast('New message from Anna 💬', '✨');
    }, 1100);
  };

  if (chatSendBtn && chatMessageInput) {
    chatSendBtn.addEventListener('click', () => {
      const text = chatMessageInput.value;
      if (text.trim()) {
        sendOutgoingMessage(text);
        chatMessageInput.value = '';
      }
    });

    chatMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = chatMessageInput.value;
        if (text.trim()) {
          sendOutgoingMessage(text);
          chatMessageInput.value = '';
        }
      }
    });
  }

  // Quick Icebreaker Chips
  const quickIcebreakers = $('#quickIcebreakers');
  if (quickIcebreakers) {
    quickIcebreakers.addEventListener('click', (e) => {
      const chip = e.target.closest('.ice-chip');
      if (!chip) return;
      const text = chip.dataset.text || chip.textContent;
      sendOutgoingMessage(text);
    });
  }

  // Sticker Drawer Toggle
  if (chatStickerBtn && chatStickerDrawer) {
    chatStickerBtn.addEventListener('click', () => {
      chatStickerDrawer.classList.toggle('hidden');
    });
  }

  if (closeStickerDrawerBtn && chatStickerDrawer) {
    closeStickerDrawerBtn.addEventListener('click', () => {
      chatStickerDrawer.classList.add('hidden');
    });
  }

  // Send Sticker on click
  document.addEventListener('click', (e) => {
    const stickerBtn = e.target.closest('.sticker-btn');
    if (stickerBtn) {
      const sticker = stickerBtn.dataset.sticker || '✨';
      sendOutgoingMessage(`${sticker} ${stickerBtn.querySelector('small').textContent}`);
      if (chatStickerDrawer) chatStickerDrawer.classList.add('hidden');
      spawnParticles(window.innerWidth / 2, window.innerHeight / 2, [sticker, '✨', '💖']);
    }
  });

  // Double-tap reaction on message bubbles
  let lastBubbleTap = 0;
  document.addEventListener('click', (e) => {
    const bubble = e.target.closest('.message-bubble');
    if (!bubble) return;
    const now = Date.now();
    if (now - lastBubbleTap < 300 && now - lastBubbleTap > 0) {
      let badge = bubble.querySelector('.bubble-reaction-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'bubble-reaction-badge';
        badge.textContent = '❤️ 1';
        bubble.appendChild(badge);
      } else {
        badge.remove();
      }
      spawnParticles(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, ['❤️', '💖']);
    }
    lastBubbleTap = now;
  });

  // In-chat voice bubble playback
  document.addEventListener('click', (e) => {
    const voicePlay = e.target.closest('.voice-bubble-play-btn');
    if (voicePlay) {
      const bubble = voicePlay.closest('.voice-bubble');
      const bars = bubble ? bubble.querySelector('.voice-bars') : null;
      if (bars) {
        voicePlay.textContent = '⏸';
        bars.classList.add('playing');
        showToast('Playing voice message from Anna 🎙️', '🎵');
        setTimeout(() => {
          voicePlay.textContent = '▶';
          bars.classList.remove('playing');
        }, 4000);
      }
    }
  });

  // =========================================================
  // 7. STORY HIGHLIGHTS & STORY VIEWER
  // =========================================================
  const storyHighlights = {
    coffee: {
      author: 'Carlo Santos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      category: '☕ Coffee Crawls',
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=85',
      badge: '📍 Campus Brews',
      caption: '"Best pour-over brew on campus after morning calculus!"'
    },
    gaming: {
      author: 'Carlo Santos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      category: '🎮 Gaming Tourneys',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=85',
      badge: '📍 Dorm Lounge B',
      caption: '"Grand finals victory in Dorm Hall B! Mario Kart champs 🏆"'
    },
    study: {
      author: 'Carlo Santos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      category: '📚 CS Lib Sprints',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=85',
      badge: '📍 Main Library Fl 3',
      caption: '"3 AM coding grind with the hackathon team before deadline!"'
    },
    food: {
      author: 'Carlo Santos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      category: '🍜 Food Crawls',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=85',
      badge: '📍 West Campus Gate',
      caption: '"Midnight taco and ramen run with the squad 🌮🍜"'
    },
    sunset: {
      author: 'Carlo Santos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      category: '🌅 Campus Lagoon',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=85',
      badge: '📍 Campus Lagoon Quad',
      caption: '"Golden hour reflection walks after evening physics lab ✨"'
    }
  };

  const storyViewerModal = $('#storyViewerModal');
  const storyViewerBackdrop = $('#storyViewerBackdrop');
  const closeStoryBtn = $('#closeStoryBtn');
  const storyProgressBar = $('#storyProgressBar');
  const storyAuthorName = $('#storyAuthorName');
  const storyCategoryName = $('#storyCategoryName');
  const storyMainImage = $('#storyMainImage');
  const storyBadgePill = $('#storyBadgePill');
  const storyCaptionText = $('#storyCaptionText');

  let storyTimer = null;

  const openStoryViewer = (key) => {
    const story = storyHighlights[key] || storyHighlights.coffee;
    if (!storyViewerModal || !storyViewerBackdrop) return;

    if (storyAuthorName) storyAuthorName.textContent = currentUser.name;
    if (storyCategoryName) storyCategoryName.textContent = story.category;
    if (storyMainImage) storyMainImage.src = story.image;
    if (storyBadgePill) storyBadgePill.textContent = story.badge;
    if (storyCaptionText) storyCaptionText.textContent = story.caption;

    if (storyProgressBar) {
      storyProgressBar.style.width = '0%';
      setTimeout(() => {
        storyProgressBar.style.transition = 'width 5s linear';
        storyProgressBar.style.width = '100%';
      }, 50);
    }

    storyViewerModal.classList.add('open');
    storyViewerBackdrop.classList.add('open');

    clearTimeout(storyTimer);
    storyTimer = setTimeout(() => {
      closeStoryViewer();
    }, 5000);
  };

  const closeStoryViewer = () => {
    clearTimeout(storyTimer);
    if (storyViewerModal && storyViewerBackdrop) {
      storyViewerModal.classList.remove('open');
      storyViewerBackdrop.classList.remove('open');
    }
  };

  if (closeStoryBtn) closeStoryBtn.addEventListener('click', closeStoryViewer);
  if (storyViewerBackdrop) storyViewerBackdrop.addEventListener('click', closeStoryViewer);

  // Click on any story bubble
  const profileStoriesRow = $('#profileStoriesRow');
  if (profileStoriesRow) {
    profileStoriesRow.addEventListener('click', (e) => {
      const item = e.target.closest('.story-bubble-item');
      if (!item) return;
      const storyKey = item.dataset.story;
      openStoryViewer(storyKey);
    });
  }

  // Story footer reaction buttons
  document.addEventListener('click', (e) => {
    const reactBtn = e.target.closest('.story-react-btn');
    if (reactBtn) {
      const emoji = reactBtn.dataset.emoji || '💖';
      spawnParticles(window.innerWidth / 2, window.innerHeight * 0.7, [emoji, '✨', '🔥']);
      showToast(`Reacted with ${emoji}!`, emoji);
    }
  });

  // =========================================================
  // 8. STUDENT PASSPORT MOOD STATUS
  // =========================================================
  const editStatusMoodBtn = $('#editStatusMoodBtn');
  const currentMoodEmoji = $('#currentMoodEmoji');
  const currentMoodText = $('#currentMoodText');

  const campusMoods = [
    { emoji: '☕', text: '"Caffeine powered & studying"' },
    { emoji: '🎮', text: '"Grinding Smash Bros in Dorm Lounge"' },
    { emoji: '📚', text: '"In the library zone, DND"' },
    { emoji: '🍜', text: '"Craving midnight ramen / boba"' },
    { emoji: '🌿', text: '"Chilling at the science quad garden"' },
    { emoji: '⚡', text: '"Free to hang after 5 PM!"' }
  ];
  let moodIndex = 0;

  if (editStatusMoodBtn) {
    editStatusMoodBtn.addEventListener('click', () => {
      moodIndex = (moodIndex + 1) % campusMoods.length;
      const m = campusMoods[moodIndex];
      if (currentMoodEmoji) currentMoodEmoji.textContent = m.emoji;
      if (currentMoodText) currentMoodText.textContent = m.text;

      // Update avatar badge in topbar too
      const topAvatarBadge = $('.avatar-status-badge');
      if (topAvatarBadge) topAvatarBadge.textContent = m.emoji;

      showToast(`Updated campus status to ${m.emoji}`, m.emoji);
    });
  }

  // =========================================================
  // 9. USER PROFILE: "SHOW WHAT YOU POST" (6+ PHOTO/REEL MOMENTS)
  // =========================================================
  let userPosts = [
    {
      id: 'post-1',
      type: 'photo',
      title: 'Midnight coffee & code sprint at 3rd floor library',
      category: 'study',
      activityIcon: '☕',
      activityName: 'Study Grind',
      location: 'Main Library Fl 3',
      timeAgo: '2h ago',
      img: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
      likes: 12,
      drops: 4,
      isUser: true
    },
    {
      id: 'post-2',
      type: 'photo',
      title: 'West Gate midnight ramen & taco run with the dorm gang',
      category: 'food',
      activityIcon: '🍜',
      activityName: 'Food Trip',
      location: 'West Campus Gate',
      timeAgo: '5h ago',
      img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      likes: 28,
      drops: 6,
      isUser: true
    },
    {
      id: 'post-3',
      type: 'reel',
      title: 'Mario Kart tournament grand finals in Lounge 3 🎮',
      category: 'gaming',
      activityIcon: '🎮',
      activityName: 'Campus Reel',
      location: 'Dorm Hall B',
      timeAgo: '1d ago',
      img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
      videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-game-controller-playing-a-video-game-41611-large.mp4',
      likes: 45,
      drops: 9,
      isUser: true
    },
    {
      id: 'post-4',
      type: 'photo',
      title: 'Campus lagoon golden hour sunset walk after physics lab',
      category: 'chill',
      activityIcon: '🌅',
      activityName: 'Lagoon Walk',
      location: 'Lagoon Quad',
      timeAgo: '2d ago',
      img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      likes: 36,
      drops: 5,
      isUser: true
    },
    {
      id: 'post-5',
      type: 'photo',
      title: 'Hackathon prototype sprint - coding until the sunrise!',
      category: 'study',
      activityIcon: '💻',
      activityName: 'Hackathon',
      location: 'CS Innovation Lab',
      timeAgo: '3d ago',
      img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80',
      likes: 52,
      drops: 11,
      isUser: true
    },
    {
      id: 'post-6',
      type: 'reel',
      title: 'Campus cafe crawl: rating 5 matcha lattes in 1 hour',
      category: 'food',
      activityIcon: '🧋',
      activityName: 'Matcha Review',
      location: 'Campus Brews & Boba',
      timeAgo: '4d ago',
      img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-pouring-milk-in-a-glass-with-coffee-and-ice-42407-large.mp4',
      likes: 64,
      drops: 14,
      isUser: true
    }
  ];

  const userPostsGrid = $('#userPostsGrid');
  const userDropsCount = $('#userDropsCount');
  const profilePostCount = $('#profilePostCount');
  const userPostsFilter = $('#userPostsFilter');

  const renderUserPosts = (filter = 'all') => {
    if (!userPostsGrid) return;

    if (userDropsCount) userDropsCount.textContent = userPosts.length;
    if (profilePostCount) profilePostCount.textContent = userPosts.length;

    let filtered = userPosts;
    if (filter === 'photo') {
      filtered = userPosts.filter((p) => p.type === 'photo');
    } else if (filter === 'reel') {
      filtered = userPosts.filter((p) => p.type === 'reel');
    } else if (filter === 'saved') {
      filtered = [
        {
          id: 'saved-1',
          type: 'photo',
          title: 'Anna: Specialty coffee and sketching at Campus Brews',
          category: 'chill',
          activityIcon: '☕',
          activityName: 'Coffee & sketching',
          location: 'Campus Brews (200m)',
          timeAgo: 'Saved',
          img: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=600&q=80',
          likes: 24,
          drops: 3
        },
        {
          id: 'saved-2',
          type: 'photo',
          title: 'Marcus: Gaming & Esports Tournament Finals',
          category: 'gaming',
          activityIcon: '🎮',
          activityName: 'Smash Tourney',
          location: 'Dorm Hall B',
          timeAgo: 'Saved',
          img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
          likes: 19,
          drops: 7
        }
      ];
    }

    if (filtered.length === 0) {
      userPostsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 24px 10px; background: #ffffff; border-radius: 16px; border: 1px dashed var(--border-color);">
          <span style="font-size: 28px; display: block; margin-bottom: 6px;">📸</span>
          <strong style="font-size: 12.5px; color: var(--ink);">No posts found in this filter</strong>
          <p style="font-size: 10.5px; color: var(--muted); margin-top: 2px;">Share your next campus moment or video loop!</p>
        </div>
      `;
      return;
    }

    userPostsGrid.innerHTML = filtered.map((post) => `
      <div class="user-post-card" data-post-id="${post.id}">
        <div class="post-thumb-wrap">
          <img src="${post.img}" alt="${post.title}" />
          <span class="post-type-badge">${post.type === 'reel' ? '🎬 REEL' : '📸 PHOTO'}</span>
        </div>
        <div class="post-card-body">
          <div class="post-activity-row">
            <span>${post.activityIcon} ${post.activityName}</span>
            <small>${post.timeAgo}</small>
          </div>
          <h4 class="post-card-title">${post.title}</h4>
          <div class="post-card-stats">
            <span class="like-tag">❤️ ${post.likes}</span>
            <span>📍 ${post.location}</span>
          </div>
        </div>
      </div>
    `).join('');
  };

  // Filter Pills inside "You" tab
  if (userPostsFilter) {
    userPostsFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.post-filter-pill');
      if (!btn) return;
      $$('.post-filter-pill').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      renderUserPosts(btn.dataset.filter);
    });
  }

  // Click on any user post to open Post Detail Modal
  const postViewModal = $('#postViewModal');
  const postViewBackdrop = $('#postViewBackdrop');
  const closePostViewBtn = $('#closePostViewBtn');
  const postModalContent = $('#postModalContent');

  if (userPostsGrid) {
    userPostsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.user-post-card');
      if (!card) return;

      const postId = card.dataset.postId;
      const post = userPosts.find((p) => p.id === postId) || userPosts[0];

      if (postModalContent) {
        postModalContent.innerHTML = `
          <div style="border-radius: 20px; overflow: hidden; margin-bottom: 14px; position: relative;">
            <img src="${post.img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover;" alt="Drop" />
            <span class="post-type-badge" style="top: 10px; right: 10px; font-size: 11px;">${post.type === 'reel' ? '🎬 CAMPUS REEL' : '📸 CAMPUS MOMENT'}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 800; color: var(--primary); background: var(--primary-light); padding: 3px 8px; border-radius: 8px;">
              ${post.activityIcon} ${post.activityName}
            </span>
            <small style="font-size: 11px; color: var(--muted); font-weight: 700;">📍 ${post.location}</small>
          </div>
          <h3 style="font-size: 15px; font-weight: 800; color: var(--ink); margin-bottom: 12px; line-height: 1.35;">${post.title}</h3>
          
          <div style="display: flex; gap: 10px; background: #f8f6fc; padding: 10px 14px; border-radius: 14px; margin-bottom: 16px;">
            <div style="flex: 1; text-align: center;">
              <strong style="display: block; font-size: 14px; color: var(--coral);">❤️ ${post.likes}</strong>
              <small style="font-size: 9.5px; color: var(--muted);">Campus Sparks</small>
            </div>
            <div style="width: 1px; background: #e8e3f4;"></div>
            <div style="flex: 1; text-align: center;">
              <strong style="display: block; font-size: 14px; color: var(--primary);">🙌 ${post.drops}</strong>
              <small style="font-size: 9.5px; color: var(--muted);">Drop-in Requests</small>
            </div>
            <div style="width: 1px; background: #e8e3f4;"></div>
            <div style="flex: 1; text-align: center;">
              <strong style="display: block; font-size: 14px; color: var(--mint);">🟢 Live</strong>
              <small style="font-size: 9.5px; color: var(--muted);">${post.timeAgo}</small>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="publish-moment-btn" id="boostDropBtn" style="margin: 0; flex: 1;">
              Boost on Campus Feed ✦
            </button>
            <button id="deleteDropBtn" data-id="${post.id}" style="padding: 12px 14px; background: #fee2e2; color: #ef4444; border-radius: 16px; font-weight: 800; font-size: 12px;">
              🗑️
            </button>
          </div>
        `;
      }

      if (postViewModal && postViewBackdrop) {
        postViewModal.classList.add('open');
        postViewBackdrop.classList.add('open');
      }
    });
  }

  const closePostModal = () => {
    if (postViewModal && postViewBackdrop) {
      postViewModal.classList.remove('open');
      postViewBackdrop.classList.remove('open');
    }
  };

  if (closePostViewBtn) closePostViewBtn.addEventListener('click', closePostModal);
  if (postViewBackdrop) postViewBackdrop.addEventListener('click', closePostModal);

  // Boost and Delete Drop handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('#boostDropBtn')) {
      closePostModal();
      showToast('Drop boosted to the top of Campus Vibe! 🚀', '✨');
      spawnParticles(window.innerWidth / 2, window.innerHeight / 2, ['🚀', '✨', '🔥', '✦']);
    }

    const delBtn = e.target.closest('#deleteDropBtn');
    if (delBtn) {
      const id = delBtn.dataset.id;
      userPosts = userPosts.filter((p) => p.id !== id);
      renderUserPosts();
      closePostModal();
      showToast('Post removed from your profile', '🗑️');
    }
  });

  // "Share Drop" chip inside Profile tab
  const profileNewDropBtn = $('#profileNewDropBtn');
  if (profileNewDropBtn) {
    profileNewDropBtn.addEventListener('click', () => {
      openShareSheet();
    });
  }

  // =========================================================
  // 10. SETTINGS MODAL ENGINE (HIDDEN IN BUTTON)
  // =========================================================
  const openSettingsBtn = $('#openSettingsBtn');
  const settingsModal = $('#settingsModal');
  const settingsBackdrop = $('#settingsBackdrop');
  const closeSettingsBtn = $('#closeSettingsBtn');
  const resetDemoDataBtn = $('#resetDemoDataBtn');
  const modalSafetyBtn = $('#modalSafetyBtn');

  const openSettings = () => {
    if (settingsModal && settingsBackdrop) {
      settingsModal.classList.add('open');
      settingsBackdrop.classList.add('open');
    }
  };

  const closeSettings = () => {
    if (settingsModal && settingsBackdrop) {
      settingsModal.classList.remove('open');
      settingsBackdrop.classList.remove('open');
    }
  };

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);

  if (modalSafetyBtn) {
    modalSafetyBtn.addEventListener('click', () => {
      showToast('Campus Safety Center opened 🛡️', '🛡️');
    });
  }

  if (resetDemoDataBtn) {
    resetDemoDataBtn.addEventListener('click', () => {
      closeSettings();
      showToast('Resetting Demo Data...', '🔄');
      setTimeout(() => {
        location.reload();
      }, 700);
    });
  }

  // =========================================================
  // 11. QUICK SHARE MOMENT / REEL SHEET (CREATOR)
  // =========================================================
  const quickShareFab = $('#quickShareFab');
  const shareSheet = $('#shareSheet');
  const sheetBackdrop = $('#sheetBackdrop');
  const closeSheetBtn = $('#closeSheetBtn');
  const shareTypeTabs = $('#shareTypeTabs');

  let currentShareType = 'moment';

  const openShareSheet = () => {
    if (shareSheet && sheetBackdrop) {
      shareSheet.classList.add('open');
      sheetBackdrop.classList.add('open');
      shareSheet.setAttribute('aria-hidden', 'false');
    }
  };

  const closeShareSheet = () => {
    if (shareSheet && sheetBackdrop) {
      shareSheet.classList.remove('open');
      sheetBackdrop.classList.remove('open');
      shareSheet.setAttribute('aria-hidden', 'true');
    }
  };

  if (quickShareFab) quickShareFab.addEventListener('click', openShareSheet);
  if (closeSheetBtn) closeSheetBtn.addEventListener('click', closeShareSheet);
  if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeShareSheet);

  if (shareTypeTabs) {
    shareTypeTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-tab-btn');
      if (!btn) return;
      $$('.type-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentShareType = btn.dataset.type;

      const mediaPickerLabel = $('#mediaPickerLabel');
      const publishMomentBtn = $('#publishMomentBtn');
      if (currentShareType === 'reel') {
        if (mediaPickerLabel) mediaPickerLabel.textContent = 'Choose a video loop vibe:';
        if (publishMomentBtn) publishMomentBtn.textContent = 'Share to Campus Reels 🎬';
      } else {
        if (mediaPickerLabel) mediaPickerLabel.textContent = 'Choose a photo vibe:';
        if (publishMomentBtn) publishMomentBtn.textContent = 'Share to Campus Vibe ✦';
      }
    });
  }

  // Preset Photo Picker
  let selectedPhotoUrl = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80';
  let selectedVideoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-group-of-friends-studying-in-a-library-4841-large.mp4';
  const presetPhotosGrid = $('#presetPhotosGrid');

  if (presetPhotosGrid) {
    presetPhotosGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.preset-photo-btn');
      if (!btn) return;
      $$('.preset-photo-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPhotoUrl = btn.dataset.img;
      selectedVideoUrl = btn.dataset.video || selectedVideoUrl;
    });
  }

  // Activity Picker
  let selectedActivityIcon = '☕';
  let selectedActivityName = 'Coffee break';
  const shareActivityGrid = $('#shareActivityGrid');
  if (shareActivityGrid) {
    shareActivityGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.act-choice');
      if (!btn) return;
      $$('.act-choice').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedActivityIcon = btn.dataset.icon;
      selectedActivityName = btn.dataset.name;
    });
  }

  // Publish Moment / Reel Button
  const publishMomentBtn = $('#publishMomentBtn');
  const feedCardsContainer = $('#feedCardsContainer');

  if (publishMomentBtn && feedCardsContainer) {
    publishMomentBtn.addEventListener('click', () => {
      const location = $('#shareLocationInput').value || 'Main Campus';
      const caption = $('#shareCaptionInput').value || 'Drop in and say hi!';

      // 1. Create card in Campus Vibe feed
      const newCard = document.createElement('article');
      newCard.className = 'moment-card';
      newCard.dataset.category = 'chill';
      newCard.innerHTML = `
        <div class="card-image-wrap">
          <img class="card-image" src="${selectedPhotoUrl}" alt="My campus moment" />
          <div class="card-gradient-shade"></div>
          <div class="moment-burst-heart">💖</div>
          <div class="card-tags">
            <span class="live-pill"><i class="dot"></i> JUST NOW</span>
            <span class="location-pill">📍 ${location}</span>
          </div>
          <div class="card-content-overlay">
            <div class="activity-badge">
              <span class="act-icon">${selectedActivityIcon}</span>
              <span>${selectedActivityName}</span>
              <small>Just now</small>
            </div>
            <div class="author-info">
              <h3>${currentUser.name.split(' ')[0]} <span>• You</span></h3>
              <p class="major-text">${caption}</p>
            </div>
          </div>
        </div>
        <div class="card-interactive-footer">
          <button class="action-btn react-btn" data-type="heart">
            <span class="icon">♡</span> <b class="count">1</b>
          </button>
          <button class="action-btn join-btn" data-author="${currentUser.name.split(' ')[0]}">
            <span>🙌</span> <b>I'm down</b>
          </button>
          <button class="action-btn chat-direct-btn" data-user="${currentUser.name.split(' ')[0]}" aria-label="Direct message ${currentUser.name.split(' ')[0]}">
            <span>↗</span>
          </button>
        </div>
      `;
      feedCardsContainer.prepend(newCard);

      // 2. Add to userPosts ("Show what you post")
      const newPostItem = {
        id: `user-post-${Date.now()}`,
        type: currentShareType === 'reel' ? 'reel' : 'photo',
        title: caption,
        category: 'chill',
        activityIcon: selectedActivityIcon,
        activityName: selectedActivityName,
        location: location,
        timeAgo: 'Just now',
        img: selectedPhotoUrl,
        videoSrc: selectedVideoUrl,
        likes: 1,
        drops: 0,
        isUser: true
      };
      userPosts.unshift(newPostItem);
      renderUserPosts();

      // 3. If shared as a Reel, add to campusReels too!
      if (currentShareType === 'reel') {
        campusReels.unshift({
          id: `reel-${Date.now()}`,
          author: `@${currentUser.name.toLowerCase().replace(/\s+/g, '_')}`,
          authorName: currentUser.name.split(' ')[0],
          authorImg: currentUser.avatar,
          verifiedBadge: `🎓 ${currentUser.uni} '26`,
          location: `📍 ${location}`,
          caption: `${caption} #UniVCupid #${currentUser.uni}`,
          sound: `Original Sound • ${currentUser.name}`,
          videoSrc: selectedVideoUrl,
          poster: selectedPhotoUrl,
          likes: 1,
          commentsCount: 0,
          isLiked: false,
          isFollowed: false,
          comments: []
        });
        currentReelIndex = 0;
        renderReel(0);
      }

      // Close modal and switch to appropriate view
      closeShareSheet();
      if (currentShareType === 'reel') {
        switchTab('tab-reels');
        showToast('🎬 Your Reel is live on Campus Reels!', '🎬');
      } else {
        switchTab('tab-vibe');
        showToast('✨ You are live on Campus Vibe!', '✦');
      }

      spawnParticles(window.innerWidth / 2, window.innerHeight / 2, ['✨', '✦', '🎉', '☕', '💖', '🎬']);
    });
  }

  // =========================================================
  // INITIAL RENDER
  // =========================================================
  renderCupidCard(0);
  renderReel(0);
  renderUserPosts('all');
});
