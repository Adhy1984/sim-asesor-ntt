/**
 * ================================================================================
 * SIM-ASESOR: vercel/app.js (Isomorphic Universal Client Adapter)
 * ================================================================================
 * Mendukung eksekusi di:
 * 1. Lingkungan Vercel / Web Standalone via Fetch REST API ke Google Apps Script.
 * 2. Lingkungan Native Google Apps Script Web App via google.script.run.
 * ================================================================================
 */

// Utilitas Deteksi Jenis Perangkat Pengguna (HP / Laptop / Tablet)
function getClientDeviceInfo() {
  try {
    const ua = navigator.userAgent || '';
    const isTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    const isMacIntelTouch = (navigator.platform === 'MacIntel' && isTouch);

    if (/iPad/i.test(ua) || isMacIntelTouch) {
      return 'Tablet (iPad)';
    }
    if (/Android/i.test(ua)) {
      return /Mobile/i.test(ua) ? 'HP (Android)' : 'Tablet (Android)';
    }
    if (/iPhone/i.test(ua)) {
      return 'HP (iPhone)';
    }
    if (/Windows NT/i.test(ua)) {
      return 'Laptop (Windows)';
    }
    if (/Macintosh/i.test(ua)) {
      return 'Laptop (macOS)';
    }
    if (/Linux/i.test(ua)) {
      return /Mobile/i.test(ua) ? 'HP (Linux)' : 'Laptop (Linux)';
    }
    if (/CrOS/i.test(ua)) {
      return 'Laptop (ChromeOS)';
    }
    if (/Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return 'HP (Mobile)';
    }
    return 'Laptop / PC';
  } catch (e) {
    return 'Laptop / PC';
  }
}

// Shim Universal google.script.run untuk Vercel / Eksternal Hosting
(function initVercelGasShim() {
  const hasNativeGas = typeof google !== 'undefined' && typeof google.script !== 'undefined' && typeof google.script.run !== 'undefined';
  if (hasNativeGas) return;

  function ApiRunner(successCb, failureCb) {
    this._successHandler = successCb || function () { };
    this._failureHandler = failureCb || function (err) { console.error('[SIM-ASESOR API Error]', err); };
  }

  ApiRunner.prototype.withSuccessHandler = function (fn) {
    return new ApiRunner(fn, this._failureHandler);
  };

  ApiRunner.prototype.withFailureHandler = function (fn) {
    return new ApiRunner(this._successHandler, fn);
  };

  ApiRunner.prototype._callApi = function (action, payload) {
    const self = this;
    const gasUrl = (typeof CONFIG !== 'undefined' && CONFIG.GAS_API_URL && !CONFIG.GAS_API_URL.includes('PASTE_WEB_APP'))
      ? CONFIG.GAS_API_URL
      : null;

    if (!gasUrl) {
      setTimeout(function () {
        self._failureHandler(new Error('URL Backend Google Apps Script belum disetel di config.js. Silakan masukkan URL Web App Apps Script Anda.'));
      }, 50);
      return;
    }

    const activeToken = (APP_STATE && APP_STATE.sessionToken) || sessionStorage.getItem('SIM_ASESOR_SESSION_TOKEN') || localStorage.getItem('SIM_ASESOR_SESSION_TOKEN');
    const requestBody = Object.assign({ action: action, token: activeToken }, payload || {});

    fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(requestBody)
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': Gagal menghubungi backend Apps Script');
        }
        return response.json();
      })
      .then(function (data) {
        self._successHandler(data);
      })
      .catch(function (err) {
        self._failureHandler(err);
      });
  };

  // Pendaftaran Seluruh Fungsi Backend Sesuai code.gs
  ApiRunner.prototype.loginUser = function (username, password, device) {
    this._callApi('loginUser', { username: username, password: password, device: device || getClientDeviceInfo() });
  };
  ApiRunner.prototype.ambilSemuaData = function () {
    this._callApi('ambilSemuaData', {});
  };
  ApiRunner.prototype.updateStatusPenilaian = function (rowNumber, field, statusBaru) {
    this._callApi('updateStatusPenilaian', { rowNumber: rowNumber, field: field, statusBaru: statusBaru });
  };
  ApiRunner.prototype.tambahPenugasan = function (payload) {
    this._callApi('tambahPenugasan', { payload: payload });
  };
  ApiRunner.prototype.catatLogAktivitas = function (username, nama, aktivitas, keterangan) {
    this._callApi('catatLogAktivitas', { username: username, nama: nama, aktivitas: aktivitas, keterangan: keterangan });
  };
  ApiRunner.prototype.ambilLogAktivitas = function () {
    this._callApi('ambilLogAktivitas', {});
  };
  ApiRunner.prototype.importDataPenilaian = function (rows, mode, currentUser) {
    this._callApi('importDataPenilaian', { rows: rows, mode: mode, currentUser: currentUser });
  };
  ApiRunner.prototype.ambilSemuaPengguna = function (currentUser) {
    this._callApi('ambilSemuaPengguna', { currentUser: currentUser });
  };
  ApiRunner.prototype.tambahPengguna = function (userData, currentUser) {
    this._callApi('tambahPengguna', { userData: userData, currentUser: currentUser });
  };
  ApiRunner.prototype.ubahPasswordPengguna = function (targetUsername, newPassword, currentUser) {
    this._callApi('ubahPasswordPengguna', { targetUsername: targetUsername, newPassword: newPassword, currentUser: currentUser });
  };
  ApiRunner.prototype.hapusPengguna = function (targetUsername, currentUser) {
    this._callApi('hapusPengguna', { targetUsername: targetUsername, currentUser: currentUser });
  };

  window._isVercelShim = true;
  window.google = {
    script: {
      run: new ApiRunner()
    }
  };
})();

// In-Memory Client Cache (Standar ZettBOT)
const hasConfiguredApi = typeof CONFIG !== 'undefined' && CONFIG.GAS_API_URL && !CONFIG.GAS_API_URL.includes('PASTE_WEB_APP');
const isNativeGAS = typeof google !== 'undefined' && typeof google.script !== 'undefined' && !window._isVercelShim;

const APP_STATE = {
  isGoogleAppsScript: isNativeGAS || hasConfiguredApi,
  currentUserRole: 'admin', // 'admin' atau 'user'
  items: [],
  daftarAsesor: [],
  stats: {},
  selectedAsesorId: 'ALL',
  currentFilterFull: 'ALL',
  chartDonutInstance: null,
  chartBarInstance: null,
  pendingModalData: null,
  lastSyncTimestamp: null,
  dashboardPage: 1,
  dashboardPageSize: 100,
  currentDashboardItems: [],
  fullTablePage: 1,
  fullTablePageSize: 100,
  currentFullItems: []
};

// Data Percontohan Default (Sesuai Gambar Tabel Pengguna)
const FALLBACK_SEED_DATA = [
  { no: 1, rowNumber: 2, npsn: '70003201', namaSekolah: 'UPTD SD NEGERI BUKRUR', jenjang: 'SD', kabSekolah: 'KABUPATEN ALOR', nia1: '12345', namaAsesor1: 'RUDI', kabAsesor1: 'ALOR', nia2: '43218', namaAsesor2: 'ANTON', kabAsesor2: 'SABU RAIJUA', status1: 'SELESAI', status2: 'SELESAI', statusKelompok: 'BELUM', tahap: 'Tahap 1' },
  { no: 2, rowNumber: 3, npsn: '50305812', namaSekolah: 'SD GMIT PROBUR I', jenjang: 'SD', kabSekolah: 'KABUPATEN ALOR', nia1: '66778', namaAsesor1: 'YON', kabAsesor1: 'SLEMAN', nia2: '55541', namaAsesor2: 'SATRIA', kabAsesor2: 'SABU RAIJUA', status1: 'SELESAI', status2: 'BELUM', statusKelompok: 'SELESAI', tahap: 'Tahap 1' },
  { no: 3, rowNumber: 4, npsn: '70026133', namaSekolah: 'MA Al-Hikmah Bahri Ternate', jenjang: 'MA', kabSekolah: 'KABUPATEN ALOR', nia1: '99123', namaAsesor1: 'BUDI', kabAsesor1: 'ALOR', nia2: '43218', namaAsesor2: 'ANTON', kabAsesor2: 'SABU RAIJUA', status1: 'SELESAI', status2: 'BELUM', statusKelompok: 'BELUM', tahap: 'Tahap 2' },
  { no: 4, rowNumber: 5, npsn: '50301294', namaSekolah: 'SMP NEGERI 1 KALABAHI', jenjang: 'SMP', kabSekolah: 'KABUPATEN ALOR', nia1: '66778', namaAsesor1: 'YON', kabAsesor1: 'SLEMAN', nia2: '12345', namaAsesor2: 'RUDI', kabAsesor2: 'ALOR', status1: 'BELUM', status2: 'SELESAI', statusKelompok: 'BELUM', tahap: 'Tahap 2' },
  { no: 5, rowNumber: 6, npsn: '50308821', namaSekolah: 'SMK NEGERI 1 ALOR', jenjang: 'SMK', kabSekolah: 'KABUPATEN ALOR', nia1: '55541', namaAsesor1: 'SATRIA', kabAsesor1: 'SABU RAIJUA', nia2: '43218', namaAsesor2: 'ANTON', kabAsesor2: 'SABU RAIJUA', status1: 'BELUM', status2: 'SELESAI', statusKelompok: 'BELUM', tahap: 'Tahap 3' },
  { no: 6, rowNumber: 7, npsn: '50304419', namaSekolah: 'SMA NEGERI 2 KALABAHI', jenjang: 'SMA', kabSekolah: 'KABUPATEN ALOR', nia1: '99123', namaAsesor1: 'BUDI', kabAsesor1: 'ALOR', nia2: '66778', namaAsesor2: 'YON', kabAsesor2: 'SLEMAN', status1: 'BELUM', status2: 'BELUM', statusKelompok: 'BELUM', tahap: 'Tahap 1' }
];

const FALLBACK_HP_MAP = {
  'RUDI': '081234567890',
  'ANTON': '082198765432',
  'YON': '085234567891',
  'SATRIA': '081398765432',
  'BUDI': '087812345678'
};

/* ==========================================================================
   MODUL EFEK RASI BINTANG / PLEXUS CONSTELLATION (STANDAR ZETTBOT v1.0.49)
   ========================================================================== */
let loginPlexusState = {
  canvas: null,
  ctx: null,
  animId: null,
  particles: [],
  numParticles: 60,
  maxDistance: 115,
  mouse: { x: null, y: null, maxDist: 130 },
  isRunning: false,
  width: 0,
  height: 0,
  dpr: 1
};

/**
 * Inisialisasi atau Resize Kanvas Rasi Bintang
 */
function setupLoginPlexusCanvas() {
  const canvas = document.getElementById('loginPlexusCanvas');
  if (!canvas) return false;
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return false;

  loginPlexusState.canvas = canvas;
  loginPlexusState.ctx = canvas.getContext('2d');
  loginPlexusState.dpr = Math.min(window.devicePixelRatio || 1, 2);

  const rect = overlay.getBoundingClientRect();
  const w = Math.max(rect.width || 0, window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const h = Math.max(rect.height || 0, window.innerHeight || 0, document.documentElement.clientHeight || 0);

  loginPlexusState.width = w;
  loginPlexusState.height = h;
  canvas.width = Math.floor(w * loginPlexusState.dpr);
  canvas.height = Math.floor(h * loginPlexusState.dpr);

  // Hitung jumlah partikel adaptif (responsif & hemat daya/GPU)
  const isMobile = w <= 640;
  loginPlexusState.numParticles = isMobile ? Math.min(Math.max(Math.floor((w * h) / 16000), 32), 48) : Math.min(Math.max(Math.floor((w * h) / 13000), 55), 80);
  loginPlexusState.maxDistance = isMobile ? 95 : 125;
  loginPlexusState.mouse.maxDist = isMobile ? 100 : 140;

  // Buat partikel bintang kosmik
  loginPlexusState.particles = [];
  const colorVariants = [
    { r: 255, g: 255, b: 255 }, // White star
    { r: 186, g: 230, b: 253 }, // Soft sky blue
    { r: 147, g: 197, b: 253 }, // Soft celestial blue
    { r: 96, g: 165, b: 250 }   // Sapphire
  ];

  for (let i = 0; i < loginPlexusState.numParticles; i++) {
    const radius = Math.random() * 1.5 + 0.9;
    const color = colorVariants[Math.floor(Math.random() * colorVariants.length)];

    loginPlexusState.particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.55),
      vy: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.55),
      radius: radius,
      baseAlpha: Math.random() * 0.45 + 0.45,
      twinkleSpeed: Math.random() * 0.03 + 0.015,
      twinklePhase: Math.random() * Math.PI * 2,
      color: color
    });
  }
  return true;
}

/**
 * Loop Animasi Rasi Bintang (60 FPS Murni Canvas 2D)
 */
function renderLoginPlexus() {
  if (!loginPlexusState.isRunning) return;

  const ctx = loginPlexusState.ctx;
  const dpr = loginPlexusState.dpr;
  const w = loginPlexusState.width;
  const h = loginPlexusState.height;
  const particles = loginPlexusState.particles;
  const maxDist = loginPlexusState.maxDistance;
  const mouse = loginPlexusState.mouse;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const num = particles.length;

  // 1. Update pergerakan partikel dan render simpul bintang
  for (let i = 0; i < num; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;

    // Pantul halus di tepi batas layar
    if (p.x < 0) { p.x = 0; p.vx = -p.vx; }
    else if (p.x > w) { p.x = w; p.vx = -p.vx; }
    if (p.y < 0) { p.y = 0; p.vy = -p.vy; }
    else if (p.y > h) { p.y = h; p.vy = -p.vy; }

    p.twinklePhase += p.twinkleSpeed;
    const currentAlpha = Math.min(Math.max(p.baseAlpha + Math.sin(p.twinklePhase) * 0.25, 0.2), 1);

    // Gambar titik bintang bersinar
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + p.color.r + ',' + p.color.g + ',' + p.color.b + ',' + currentAlpha + ')';
    ctx.shadowColor = 'rgba(' + p.color.r + ',' + p.color.g + ',' + p.color.b + ', 0.6)';
    ctx.shadowBlur = 4;
    ctx.fill();
  }

  ctx.shadowBlur = 0; // Reset blur sebelum menggambar garis

  // 2. Hubungkan garis rasi antar simpul bintang
  for (let i = 0; i < num; i++) {
    const p1 = particles[i];
    for (let j = i + 1; j < num; j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxDist) {
        const lineAlpha = (1 - (dist / maxDist)) * 0.38;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = 'rgba(147, 197, 253,' + lineAlpha + ')';
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    }

    // 3. Garis interaksi rasi bintang ke kursor mouse/sentuhan
    if (mouse.x !== null && mouse.y !== null) {
      const mdx = p1.x - mouse.x;
      const mdy = p1.y - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist < mouse.maxDist) {
        const mAlpha = (1 - (mdist / mouse.maxDist)) * 0.45;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = 'rgba(96, 165, 250,' + mAlpha + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  loginPlexusState.animId = requestAnimationFrame(renderLoginPlexus);
}

/**
 * Memulai Animasi Rasi Bintang
 */
function startLoginPlexusEffect() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay || overlay.style.display === 'none') return;

  if (!loginPlexusState.canvas) {
    setupLoginPlexusCanvas();
  }

  if (!loginPlexusState.isRunning) {
    loginPlexusState.isRunning = true;
    renderLoginPlexus();
  }
}

/**
 * Menghentikan Animasi Rasi Bintang (0% CPU/GPU saat berada di dashboard)
 */
function stopLoginPlexusEffect() {
  loginPlexusState.isRunning = false;
  if (loginPlexusState.animId) {
    cancelAnimationFrame(loginPlexusState.animId);
    loginPlexusState.animId = null;
  }
}

// Listener interaksi mouse/touch pasif untuk rasi bintang
window.addEventListener('mousemove', function (e) {
  if (!loginPlexusState.isRunning) return;
  const overlay = document.getElementById('loginOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  loginPlexusState.mouse.x = e.clientX;
  loginPlexusState.mouse.y = e.clientY;
}, { passive: true });

window.addEventListener('mouseleave', function () {
  loginPlexusState.mouse.x = null;
  loginPlexusState.mouse.y = null;
}, { passive: true });

window.addEventListener('touchmove', function (e) {
  if (!loginPlexusState.isRunning || !e.touches || e.touches.length === 0) return;
  const overlay = document.getElementById('loginOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  loginPlexusState.mouse.x = e.touches[0].clientX;
  loginPlexusState.mouse.y = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', function () {
  loginPlexusState.mouse.x = null;
  loginPlexusState.mouse.y = null;
}, { passive: true });

// Listener resize window responsif
let resizePlexusTimer = null;
window.addEventListener('resize', function () {
  if (!loginPlexusState.isRunning) return;
  clearTimeout(resizePlexusTimer);
  resizePlexusTimer = setTimeout(function () {
    setupLoginPlexusCanvas();
  }, 150);
});

/**
 * Toggle Visibilitas Kata Sandi (Password)
 */
function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPassword');
  const btn = document.getElementById('btnTogglePassword');
  if (!pwdInput || !btn) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    btn.setAttribute('aria-label', 'Sembunyikan kata sandi');
    btn.title = 'Sembunyikan kata sandi';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    pwdInput.type = 'password';
    btn.setAttribute('aria-label', 'Lihat kata sandi');
    btn.title = 'Lihat kata sandi';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

/**
 * Manajemen Sesi & Autentikasi Pengguna (Database Sheet DataUser)
 */
/**
 * ================================================================================
 * KONFIGURASI GOOGLE OAUTH 2.0 CLIENT ID (Model 2 Whitelist)
 * ================================================================================
 * Ganti string di bawah ini dengan Client ID dari Google Cloud Console Anda:
 */
const GOOGLE_OAUTH_CLIENT_ID = '511677848585-9temisn6mq9nfgmjlirj2a5d76jkqm2g.apps.googleusercontent.com';

/**
 * Dekode JWT Payload dari Google Identity Services
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Inisialisasi Google Identity Services (GIS)
 */
function initGoogleSignIn() {
  const gContainer = document.getElementById('googleBtnContainer');
  const placeholderBtn = document.getElementById('btnGooglePlaceholder');

  const isPlaceholder = !GOOGLE_OAUTH_CLIENT_ID ||
    GOOGLE_OAUTH_CLIENT_ID.indexOf('YOUR_GOOGLE_CLIENT_ID_HERE') !== -1 ||
    GOOGLE_OAUTH_CLIENT_ID.trim() === '';

  if (isPlaceholder) {
    // Tampilkan tombol placeholder dengan indikator siap pakai
    if (gContainer) gContainer.style.display = 'none';
    if (placeholderBtn) placeholderBtn.style.display = 'flex';
    return;
  }

  // Jika Client ID sudah diisi, render tombol resmi Google
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      if (placeholderBtn) placeholderBtn.style.display = 'none';
      if (gContainer) {
        gContainer.style.display = 'block';
        gContainer.innerHTML = '';
        google.accounts.id.renderButton(gContainer, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320
        });
      }
    } catch (err) {
      console.warn('Google Identity initialization error:', err);
      if (placeholderBtn) placeholderBtn.style.display = 'flex';
    }
  } else {
    // Retry jika script GIS belum selesai termuat
    setTimeout(initGoogleSignIn, 500);
  }
}

/**
 * Handler saat tombol placeholder Google diklik sebelum Client ID diganti
 */
function handleGooglePlaceholderClick() {
  const errMsg = document.getElementById('loginErrorMsg');
  const infoMsg = 'Tanda pengenal Google Client ID aktif (Placeholder). Untuk mengaktifkan pop-up akun Google, silakan pasang Client ID Anda pada GOOGLE_OAUTH_CLIENT_ID di file script. Anda tetap bisa masuk menggunakan form nama pengguna & kata sandi di bawah.';
  if (errMsg) {
    errMsg.textContent = infoMsg;
    errMsg.style.display = 'block';
  }
  showToast(infoMsg, 'info', 7000);
}

/**
 * Callback setelah pengguna memilih akun Google di pop-up resmi
 */
function handleGoogleCredentialResponse(response) {
  const errMsg = document.getElementById('loginErrorMsg');
  if (errMsg) errMsg.style.display = 'none';

  if (!response || !response.credential) {
    if (errMsg) {
      errMsg.textContent = 'Gagal memverifikasi akun Google: Kredensial tidak diterima.';
      errMsg.style.display = 'block';
    }
    return;
  }

  const payload = parseJwt(response.credential);
  const email = payload && payload.email ? payload.email : '';
  const name = payload && payload.name ? payload.name : '';
  const devType = getClientDeviceInfo();

  if (!email) {
    if (errMsg) {
      errMsg.textContent = 'Gagal membaca alamat email dari akun Google.';
      errMsg.style.display = 'block';
    }
    return;
  }

  showToast('Memverifikasi whitelist email: ' + email + '...', 'info', 3000);

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          loginSuccess(res.user, res.token || res.sessionToken);
          showToast('Selamat datang, ' + (res.user.nama || email) + '!', 'success');
        } else {
          if (errMsg) {
            errMsg.textContent = (res && res.message) ? res.message : 'Akun Google Anda belum terdaftar di sistem SIM-ASESOR.';
            errMsg.style.display = 'block';
          }
          showToast((res && res.message) ? res.message : 'Akses ditolak: Email belum terdaftar.', 'error', 6000);
        }
      })
      .withFailureHandler(function (err) {
        if (errMsg) {
          errMsg.textContent = 'Gagal menghubungi server database: ' + err.toString();
          errMsg.style.display = 'block';
        }
        showToast('Gagal verifikasi server: ' + err.toString(), 'error', 5000);
      })
      .loginWithGoogle(email, response.credential, devType);
  } else {
    // Mode Vercel / Web API Standalone
    fetch('/api/login-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, idToken: response.credential, device: devType })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success) {
          loginSuccess(res.user, res.token || res.sessionToken);
          showToast('Selamat datang, ' + (res.user.nama || email) + '!', 'success');
        } else {
          if (errMsg) {
            errMsg.textContent = (res && res.message) ? res.message : 'Akses ditolak: Email belum terdaftar.';
            errMsg.style.display = 'block';
          }
          showToast((res && res.message) ? res.message : 'Akses ditolak: Email belum terdaftar.', 'error', 6000);
        }
      })
      .catch(function (err) {
        if (errMsg) {
          errMsg.textContent = 'Akses ditolak: Email ' + email + ' belum terdaftar di database.';
          errMsg.style.display = 'block';
        }
      });
  }
}

function submitLogin(e) {
  if (e) e.preventDefault();
  const userInp = document.getElementById('loginUsername');
  const passInp = document.getElementById('loginPassword');
  const u = (userInp ? userInp.value : '').trim();
  const p = (passInp ? passInp.value : '').trim();
  const errMsg = document.getElementById('loginErrorMsg');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  if (!u || !p) {
    if (errMsg) {
      errMsg.textContent = 'Silakan masukkan username dan password.';
      errMsg.style.display = 'block';
    }
    return;
  }

  if (errMsg) errMsg.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Memverifikasi akun...</span>';
  }

  if (APP_STATE.isGoogleAppsScript) {
    // Panggilan API Backend ke tab DataUser Google Sheets
    google.script.run
      .withSuccessHandler(function (res) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Masuk ke Sistem</span><svg width="18" height="18" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
        if (res && res.success) {
          loginSuccess(res.user, res.token);
        } else {
          if (errMsg) {
            errMsg.textContent = (res && res.message) ? res.message : 'Username atau password tidak cocok.';
            errMsg.style.display = 'block';
          }
        }
      })
      .withFailureHandler(function (err) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Masuk ke Sistem</span><svg width="18" height="18" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
        if (errMsg) {
          errMsg.textContent = 'Gagal menghubungi server database: ' + err.toString();
          errMsg.style.display = 'block';
        }
      })
      .loginUser(u, p, getClientDeviceInfo());
  } else {
    // Simulasi Standalone Browser (Kredensial Bawaan Sheet DataUser)
    setTimeout(function () {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Masuk ke Sistem</span><svg width="18" height="18" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
      }
      const uLower = u.toLowerCase();
      const devType = getClientDeviceInfo();
      if (uLower === 'admin' && p === 'admin') {
        loginSuccess({ username: 'admin', nama: 'Administrator Sistem', role: 'Admin', perangkat: devType });
      } else if (uLower === 'user' && p === 'user') {
        loginSuccess({ username: 'user', nama: 'Pengguna Asesor', role: 'User', perangkat: devType });
      } else {
        if (errMsg) {
          errMsg.textContent = 'Username atau password tidak cocok. Gunakan admin / admin atau user / user.';
          errMsg.style.display = 'block';
        }
      }
    }, 300);
  }
}

function loginSuccess(userData, sessionToken) {
  if (sessionToken) {
    APP_STATE.sessionToken = sessionToken;
    try {
      sessionStorage.setItem('SIM_ASESOR_SESSION_TOKEN', sessionToken);
      localStorage.setItem('SIM_ASESOR_SESSION_TOKEN', sessionToken);
    } catch (e) { }
  }
  let userObj = userData;
  if (typeof userData === 'string') {
    const roleCapitalized = userData.toLowerCase() === 'admin' ? 'Admin' : 'User';
    userObj = { username: userData, nama: roleCapitalized, role: roleCapitalized };
  }

  APP_STATE.currentUser = userObj;
  sessionStorage.setItem('SIM_ASESOR_USER', JSON.stringify(userObj));
  sessionStorage.setItem('SIM_ASESOR_ROLE', userObj.role.toLowerCase());
  try {
    localStorage.setItem('SIM_ASESOR_USER', JSON.stringify(userObj));
    localStorage.setItem('SIM_ASESOR_ROLE', userObj.role.toLowerCase());
    localStorage.setItem('SIM_ASESOR_LAST_ACTIVITY', Date.now().toString());
  } catch (err) { }
  applyUserRole(userObj.role, userObj.nama);

  // Kembalikan seluruh filter sistem ke status default awal (v1.0.58)
  if (typeof resetAllSystemFilters === 'function') {
    resetAllSystemFilters();
  }

  document.documentElement.classList.add('is-authenticated');
  if (typeof recordUserActivity === 'function') recordUserActivity();
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
  if (document.body) document.body.classList.remove('login-active');
  stopLoginPlexusEffect();

  showToast('Selamat datang, ' + userObj.nama + ' (' + userObj.role + ')');
}

function handleLogout(e, isTimeout) {
  if (APP_STATE.isGoogleAppsScript && APP_STATE.sessionToken) {
    try { google.script.run.logoutUser(APP_STATE.sessionToken); } catch (eLogout) { }
  }
  APP_STATE.sessionToken = null;
  try {
    sessionStorage.removeItem('SIM_ASESOR_SESSION_TOKEN');
    localStorage.removeItem('SIM_ASESOR_SESSION_TOKEN');
  } catch (eTok) { }
  if (e && e.preventDefault) e.preventDefault();
  const userMenu = document.getElementById('userDropdownMenu');
  const userWrapper = document.getElementById('userDropdownWrapper');
  const userBtn = document.getElementById('userProfileBtn');
  if (userMenu) userMenu.classList.remove('show');
  if (userWrapper) userWrapper.classList.remove('open');
  if (userBtn) userBtn.setAttribute('aria-expanded', 'false');

  sessionStorage.removeItem('SIM_ASESOR_USER');
  sessionStorage.removeItem('SIM_ASESOR_ROLE');
  try {
    localStorage.removeItem('SIM_ASESOR_USER');
    localStorage.removeItem('SIM_ASESOR_ROLE');
    localStorage.removeItem('SIM_ASESOR_LAST_ACTIVITY');
    localStorage.removeItem('SIM_ASESOR_DATA_CACHE');
  } catch (err) { }
  document.documentElement.classList.remove('is-authenticated');
  APP_STATE.currentUserRole = null;
  APP_STATE.currentUser = null;

  const adminDropdownActions = document.getElementById('adminDropdownActions');
  const mobileAdminActions = document.getElementById('mobileAdminActions');
  if (adminDropdownActions) adminDropdownActions.style.display = 'none';
  if (mobileAdminActions) mobileAdminActions.style.display = 'none';

  // Reset seluruh filter sistem ke kondisi awal (default) saat logout (v1.0.58)
  if (typeof resetAllSystemFilters === 'function') {
    resetAllSystemFilters();
  }

  const userInp = document.getElementById('loginUsername');
  const passInp = document.getElementById('loginPassword');
  const errMsg = document.getElementById('loginErrorMsg');
  if (userInp) userInp.value = '';
  if (passInp) passInp.value = '';
  if (errMsg) errMsg.style.display = 'none';

  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'flex';
  if (document.body) document.body.classList.add('login-active');
  startLoginPlexusEffect();
  if (userInp) userInp.focus();

  if (isTimeout) {
    showToast('Sesi Anda berakhir karena tidak ada aktivitas selama 15 menit. Silakan login kembali.', true);
  } else {
    showToast('Sesi Anda telah diakhiri.');
  }
}

function applyUserRole(role, nama) {
  const roleStr = String(role || 'user').toLowerCase();
  APP_STATE.currentUserRole = roleStr;

  const roleText = document.getElementById('userRoleText');
  const mobileRoleText = document.getElementById('mobileUserRoleText');
  const userDropdownFullName = document.getElementById('userDropdownFullName');
  const userDropdownRoleTag = document.getElementById('userDropdownRoleTag');

  const adminDropdownActions = document.getElementById('adminDropdownActions');
  const mobileAdminActions = document.getElementById('mobileAdminActions');

  const navData = document.getElementById('navTabData');
  const navPenugasan = document.getElementById('navTabPenugasan');
  const navPrint = document.getElementById('navTabPrint');

  const mobileNavData = document.getElementById('mobileNavTabData');
  const mobileNavPenugasan = document.getElementById('mobileNavTabPenugasan');
  const mobileNavPrint = document.getElementById('mobileNavTabPrint');

  if (roleStr === 'user') {
    const txt = nama ? 'User: ' + nama : 'User: Pengguna';
    if (roleText) roleText.textContent = txt;
    if (mobileRoleText) mobileRoleText.textContent = txt;
    if (userDropdownFullName) userDropdownFullName.textContent = nama || 'Pengguna Asesor';
    if (userDropdownRoleTag) userDropdownRoleTag.textContent = 'Peran: User (Dashboard Saja)';

    if (adminDropdownActions) adminDropdownActions.style.display = 'none';
    if (mobileAdminActions) mobileAdminActions.style.display = 'none';

    if (navData) navData.style.display = 'none';
    if (navPenugasan) navPenugasan.style.display = 'none';
    if (navPrint) navPrint.style.display = 'none';

    if (mobileNavData) mobileNavData.style.display = 'none';
    if (mobileNavPenugasan) mobileNavPenugasan.style.display = 'none';
    if (mobileNavPrint) mobileNavPrint.style.display = 'none';

    switchTab('dashboard');
  } else {
    const txt = nama ? 'Admin: ' + nama : 'Admin';
    if (roleText) roleText.textContent = txt;
    if (mobileRoleText) mobileRoleText.textContent = txt;
    if (userDropdownFullName) userDropdownFullName.textContent = nama || 'Administrator Sistem';
    if (userDropdownRoleTag) userDropdownRoleTag.textContent = 'Peran: Administrator Sistem';

    if (adminDropdownActions) adminDropdownActions.style.display = 'block';
    if (mobileAdminActions) mobileAdminActions.style.display = 'flex';

    if (navData) navData.style.display = 'flex';
    if (navPenugasan) navPenugasan.style.display = 'flex';
    if (navPrint) navPrint.style.display = 'flex';

    if (mobileNavData) mobileNavData.style.display = 'flex';
    if (mobileNavPenugasan) mobileNavPenugasan.style.display = 'flex';
    if (mobileNavPrint) mobileNavPrint.style.display = 'flex';
  }

  // Perbarui tabel dashboard agar status badge menyesuaikan izin
  if (typeof updateDynamicDashboard === 'function') {
    updateDynamicDashboard();
  }
}

/* ==========================================================================
   IDLE SESSION TIMEOUT MANAGER (15 MENIT INAKTIVITAS - v1.0.57)
   ========================================================================== */
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Menit (900.000 ms)
let lastActivityRecordTime = 0;

/**
 * Memperbarui stempel waktu aktivitas pengguna (di-throttle maks 1x per 5 detik)
 */
function recordUserActivity() {
  if (!APP_STATE.currentUser) return;
  const now = Date.now();
  if (now - lastActivityRecordTime < 5000) return; // Throttle 5 detik
  lastActivityRecordTime = now;
  try {
    localStorage.setItem('SIM_ASESOR_LAST_ACTIVITY', now.toString());
  } catch (e) { }
}

/**
 * Memeriksa apakah sesi telah melampaui batas inaktivitas 15 menit
 */
function checkSessionTimeout() {
  if (!APP_STATE.currentUser) return;
  try {
    const lastActStr = localStorage.getItem('SIM_ASESOR_LAST_ACTIVITY');
    if (!lastActStr) return;
    const lastAct = parseInt(lastActStr, 10);
    if (isNaN(lastAct) || lastAct <= 0) return;

    const elapsed = Date.now() - lastAct;
    if (elapsed >= SESSION_IDLE_TIMEOUT_MS) {
      handleLogout(null, true);
    }
  } catch (e) { }
}

/**
 * Menginisialisasi pendengar interaksi pengguna & sinkronisasi multi-tab
 */
function initSessionIdleManager() {
  if (window._sessionIdleManagerInitialized) return;
  window._sessionIdleManagerInitialized = true;

  // Pantau event interaksi pasif pengguna (ramah CPU/baterai)
  const passiveEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
  passiveEvents.forEach(function (evt) {
    window.addEventListener(evt, recordUserActivity, { passive: true });
  });

  // Pengecekan berkala setiap 10 detik
  setInterval(checkSessionTimeout, 10000);

  // Sinkronisasi logout antar tab secara otomatis
  window.addEventListener('storage', function (e) {
    if (e.key === 'SIM_ASESOR_USER' && !e.newValue && APP_STATE.currentUser) {
      handleLogout(null, false);
    }
  });
}

// Inisialisasi saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', function () {
  initAppDate();
  initMobileDrawerLogo();
  initOpenInNewTabOnButtons();
  initSessionIdleManager();
  initGoogleSignIn();

  // Validasi batas inaktivitas 15 menit sebelum memulihkan sesi
  const lastAct = parseInt(localStorage.getItem('SIM_ASESOR_LAST_ACTIVITY') || '0', 10);
  const isExpired = lastAct && (Date.now() - lastAct >= SESSION_IDLE_TIMEOUT_MS);
  if (isExpired) {
    sessionStorage.removeItem('SIM_ASESOR_USER');
    sessionStorage.removeItem('SIM_ASESOR_ROLE');
    sessionStorage.removeItem('SIM_ASESOR_SESSION_TOKEN');
    try {
      localStorage.removeItem('SIM_ASESOR_USER');
      localStorage.removeItem('SIM_ASESOR_ROLE');
      localStorage.removeItem('SIM_ASESOR_SESSION_TOKEN');
      localStorage.removeItem('SIM_ASESOR_LAST_ACTIVITY');
      localStorage.removeItem('SIM_ASESOR_DATA_CACHE');
    } catch (e) { }
  }

  let storedToken = sessionStorage.getItem('SIM_ASESOR_SESSION_TOKEN');
  if (!storedToken) {
    try { storedToken = localStorage.getItem('SIM_ASESOR_SESSION_TOKEN'); } catch (e) { }
  }

  let savedUserStr = sessionStorage.getItem('SIM_ASESOR_USER');
  if (!savedUserStr) {
    try { savedUserStr = localStorage.getItem('SIM_ASESOR_USER'); } catch (e) { }
  }
  const overlay = document.getElementById('loginOverlay');

  if (savedUserStr && storedToken && !isExpired) {
    try {
      const userObj = JSON.parse(savedUserStr);
      APP_STATE.currentUser = userObj;
      APP_STATE.sessionToken = storedToken;
      document.documentElement.classList.add('is-authenticated');
      recordUserActivity();
      if (overlay) overlay.style.display = 'none';
      if (document.body) document.body.classList.remove('login-active');
      applyUserRole(userObj.role, userObj.nama);
    } catch (e) {
      handleLogout();
    }
  } else {
    if (savedUserStr && !storedToken) {
      sessionStorage.removeItem('SIM_ASESOR_USER');
      sessionStorage.removeItem('SIM_ASESOR_ROLE');
      try {
        localStorage.removeItem('SIM_ASESOR_USER');
        localStorage.removeItem('SIM_ASESOR_ROLE');
        localStorage.removeItem('SIM_ASESOR_SESSION_TOKEN');
      } catch (e) { }
    }
    document.documentElement.classList.remove('is-authenticated');
    if (overlay) overlay.style.display = 'flex';
    if (document.body) document.body.classList.add('login-active');
    startLoginPlexusEffect();
    const userInp = document.getElementById('loginUsername');
    if (userInp) userInp.focus();
    if (isExpired) {
      showToast('Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit.', true);
    }
  }

  // 1. Jalankan perutean hash URL awal secara instan (0 detik) agar tab yang diminta langsung aktif
  handleInitialHashRoute();

  // 2. Cek ketersediaan cache snapshot data lintas-tab (SIM_ASESOR_DATA_CACHE) untuk pemuatan instan 0 detik
  let hasLocalCache = false;
  try {
    const rawCache = localStorage.getItem('SIM_ASESOR_DATA_CACHE');
    if (rawCache) {
      const cached = JSON.parse(rawCache);
      if (cached && Array.isArray(cached.items) && cached.items.length > 0 && cached.stats && cached.daftarAsesor) {
        applyLoadedData(cached.items, cached.daftarAsesor, cached.stats, cached.lastSyncTimestamp);
        hasLocalCache = true;
      }
    }
  } catch (cacheErr) {
    console.warn('Gagal memuat cache lintas-tab:', cacheErr);
  }

  // 3. Hanya ambil data dari server jarak jauh jika belum ada data di cache lokal
  if (!hasLocalCache) {
    refreshData(false);
  }
});

function initAppDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const todayStr = new Date().toLocaleDateString('id-ID', options);
  const printDateEl = document.getElementById('printDateMeta');
  if (printDateEl) printDateEl.textContent = todayStr;
  const sigDateEl = document.getElementById('sigDateLabel');
  if (sigDateEl) sigDateEl.textContent = 'Kupang, ' + new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Memuat atau menyegarkan data dari Backend (GAS / Mock Fallback)
 */
function refreshData(isManual) {
  const btn = document.getElementById('btnRefresh');
  const mobileBtn = document.getElementById('btnMobileRefresh');
  const metricsGrid = document.querySelector('.metrics-grid');
  if (btn) btn.classList.add('spinning');
  if (mobileBtn) mobileBtn.classList.add('spinning');
  if (metricsGrid && isManual) metricsGrid.classList.add('is-refreshing');

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (btn) btn.classList.remove('spinning');
        if (mobileBtn) mobileBtn.classList.remove('spinning');
        if (metricsGrid) metricsGrid.classList.remove('is-refreshing');
        if (res && res.success) {
          applyLoadedData(res.data, res.daftarAsesor, res.stats);
        } else {
          showToast('Gagal memuat data dari server', true);
        }
      })
      .withFailureHandler(function (err) {
        if (btn) btn.classList.remove('spinning');
        if (mobileBtn) mobileBtn.classList.remove('spinning');
        if (metricsGrid) metricsGrid.classList.remove('is-refreshing');
        showToast('Error koneksi: ' + err.toString(), true);
      })
      .ambilSemuaData();
  } else {
    // Mode Standalone Browser (Simulasi Cerdas)
    setTimeout(function () {
      if (btn) btn.classList.remove('spinning');
      if (mobileBtn) mobileBtn.classList.remove('spinning');
      if (metricsGrid) metricsGrid.classList.remove('is-refreshing');
      const savedData = localStorage.getItem('SIM_ASESOR_DATA');
      let items = savedData ? JSON.parse(savedData) : FALLBACK_SEED_DATA;
      const computed = computeStatsAndAsesorList(items);
      applyLoadedData(items, computed.daftarAsesor, computed.stats);
    }, 350);
  }
}

/**
 * Menghitung statistik dan daftar unik asesor dari array items
 */
function computeStatsAndAsesorList(items) {
  const asesorMap = {};
  let totalFields = 0;
  let totalSelesai = 0;

  items.forEach(function (item) {
    // Tanggung Jawab Penilaian:
    // Asesor 1: Menilai Nilai Asesor 1 dan Nilai Kelompok (2 item)
    // Asesor 2: Menilai Nilai Asesor 2 (1 item)
    totalFields += 3;
    if (item.status1 === 'SELESAI') totalSelesai++;
    if (item.statusKelompok === 'SELESAI') totalSelesai++;
    if (item.status2 === 'SELESAI') totalSelesai++;

    // Asesor 1 (Menilai Nilai Asesor 1 dan Juga Nilai Kelompok)
    const nama1 = (item.namaAsesor1 || '').trim();
    if (nama1) {
      const k1 = nama1.toUpperCase();
      if (!asesorMap[k1]) {
        asesorMap[k1] = {
          id: k1,
          nia: item.nia1 || '-',
          nama: nama1,
          hp: item.hp1 || (typeof FALLBACK_HP_MAP !== 'undefined' && FALLBACK_HP_MAP[k1] ? FALLBACK_HP_MAP[k1] : '-'),
          kabupaten: item.kabAsesor1 || '-',
          peran: 'Asesor 1',
          totalTugas: 0,
          selesai: 0,
          belum: 0,
          jenjangMap: {},
          sekolahList: []
        };
      }
      asesorMap[k1].totalTugas++;
      if (item.status1 === 'SELESAI') asesorMap[k1].selesai++; else asesorMap[k1].belum++;
      if (item.statusKelompok === 'SELESAI') asesorMap[k1].selesai++; else asesorMap[k1].belum++;
      asesorMap[k1].jenjangMap[item.jenjang] = (asesorMap[k1].jenjangMap[item.jenjang] || 0) + 1;
      asesorMap[k1].sekolahList.push(item.npsn);
    }

    // Asesor 2 (Hanya Menilai Nilai Asesor 2)
    const nama2 = (item.namaAsesor2 || '').trim();
    if (nama2) {
      const k2 = nama2.toUpperCase();
      if (!asesorMap[k2]) {
        asesorMap[k2] = {
          id: k2,
          nia: item.nia2 || '-',
          nama: nama2,
          hp: item.hp2 || (typeof FALLBACK_HP_MAP !== 'undefined' && FALLBACK_HP_MAP[k2] ? FALLBACK_HP_MAP[k2] : '-'),
          kabupaten: item.kabAsesor2 || '-',
          peran: 'Asesor 2',
          totalTugas: 0,
          selesai: 0,
          belum: 0,
          jenjangMap: {},
          sekolahList: []
        };
      } else if (asesorMap[k2].peran === 'Asesor 1') {
        asesorMap[k2].peran = 'Asesor 1 & 2';
      }
      asesorMap[k2].totalTugas++;
      if (item.status2 === 'SELESAI') asesorMap[k2].selesai++; else asesorMap[k2].belum++;
      asesorMap[k2].jenjangMap[item.jenjang] = (asesorMap[k2].jenjangMap[item.jenjang] || 0) + 1;
      if (!asesorMap[k2].sekolahList.includes(item.npsn)) asesorMap[k2].sekolahList.push(item.npsn);
    }
  });

  const daftarAsesor = Object.keys(asesorMap).map(function (k) {
    const a = asesorMap[k];
    const totalItem = (a.selesai + a.belum);
    a.persen = totalItem > 0 ? Math.round((a.selesai / totalItem) * 100) : 0;
    return a;
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  const persenGlobal = totalFields > 0 ? Math.round((totalSelesai / totalFields) * 100) : 0;

  return {
    daftarAsesor: daftarAsesor,
    stats: {
      totalSekolah: items.length,
      totalAsesor: daftarAsesor.length,
      totalSelesai: totalSelesai,
      totalBelum: totalFields - totalSelesai,
      persenSelesai: persenGlobal
    }
  };
}

/**
 * Menerapkan data yang sudah dimuat ke dalam UI dan state
 * Mendukung customTimestamp untuk pemuatan instan dari cache snapshot lintas-tab (v1.0.61)
 */
function applyLoadedData(items, daftarAsesor, stats, customTimestamp, dbAsesorList) {
  APP_STATE.items = items;
  APP_STATE.daftarAsesor = daftarAsesor;
  APP_STATE.stats = stats;

  if (Array.isArray(dbAsesorList) && dbAsesorList.length > 0) {
    DB_ASESOR_STATE.asesors = dbAsesorList;
    try {
      localStorage.setItem('SIM_ASESOR_DB_ASESOR_CACHE', JSON.stringify(dbAsesorList));
    } catch (eDb) { }
  }

  // Format Timestamp Log Tarikan Data (Tanggal & Jam)
  let datePart = '';
  let timePart = '';
  let formattedTimestamp = '';

  if (customTimestamp) {
    formattedTimestamp = customTimestamp;
    const parts = customTimestamp.split(', ');
    datePart = parts[0] ? parts[0] + ', ' : '';
    timePart = parts[1] || customTimestamp;
  } else {
    const now = new Date();
    const dPart = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const tPart = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\./g, ':');
    datePart = dPart + ', ';
    timePart = tPart + ' WITA';
    formattedTimestamp = dPart + ', ' + tPart + ' WITA';
  }
  APP_STATE.lastSyncTimestamp = formattedTimestamp;

  // Simpan snapshot dataset lengkap ke cache lintas-tab (0 detik instan untuk tab baru)
  try {
    const cachePayload = {
      items: items,
      daftarAsesor: daftarAsesor,
      stats: stats,
      dbAsesor: (Array.isArray(dbAsesorList) && dbAsesorList.length > 0) ? dbAsesorList : (DB_ASESOR_STATE.asesors || []),
      lastSyncTimestamp: formattedTimestamp,
      savedAt: Date.now()
    };
    localStorage.setItem('SIM_ASESOR_DATA_CACHE', JSON.stringify(cachePayload));
  } catch (cacheErr) {
    console.warn('Gagal menyimpan cache lintas-tab:', cacheErr);
  }

  const lastSyncDateEl = document.getElementById('lastSyncDate');
  if (lastSyncDateEl) lastSyncDateEl.textContent = datePart;
  const lastSyncEl = document.getElementById('lastSyncTime');
  if (lastSyncEl) lastSyncEl.textContent = timePart.includes('WITA') ? timePart : (timePart + ' WITA');
  const mobileLastSyncEl = document.getElementById('mobileLastSyncTime');
  if (mobileLastSyncEl) mobileLastSyncEl.textContent = formattedTimestamp;
  const printSyncEl = document.getElementById('printSyncTimeMeta');
  if (printSyncEl) printSyncEl.textContent = formattedTimestamp;

  // Update KPI Cards (dengan animasi counter count-up)
  animateCounter(document.getElementById('kpiTotalSekolah'), stats.totalSekolah || 0, 850);
  animateCounter(document.getElementById('kpiTotalAsesor'), stats.totalAsesor || 0, 850);
  animateCounter(document.getElementById('kpiTotalSelesai'), stats.totalSelesai || 0, 850);
  animateCounter(document.getElementById('kpiTotalBelum'), stats.totalBelum || 0, 850);
  animateCounter(document.getElementById('kpiPersenSelesai'), stats.persenSelesai || 0, 850, '%');

  // Update Dropdown Asesor & Filter
  populateAsesorDropdowns();
  populatePenugasanDropdown();
  populateJenjangDropdown();

  // Render Charts & Tables
  updateDynamicDashboard();
  renderFullTable();
  renderPrintPreview();
  renderPenugasanData();

  // Sinkronisasi tab sesuai URL Hash yang diminta (misal di-open in new tab)
  handleInitialHashRoute();
}

// ==========================================================================
// STANDAR HIERARKI JENJANG & PALET WARNA GRAFIK
// ==========================================================================
const STANDARD_JENJANG_ORDER = [
  'PAUD', 'TK', 'KB', 'TPA', 'SPS', 'RA',
  'SD', 'MI',
  'SMP', 'MTS',
  'SMA', 'MA', 'SMK',
  'SLB', 'PKBM', 'SKB'
];

const JENJANG_PALETTE = {
  'SD': 'rgba(239, 68, 68, 0.85)',       // Merah Cerah
  'SMP': 'rgba(59, 130, 246, 0.85)',     // Biru
  'SMA': 'rgba(99, 102, 241, 0.85)',     // Indigo
  'SMK': 'rgba(245, 158, 11, 0.85)',     // Kuning/Oranye
  'MA': 'rgba(16, 185, 129, 0.85)',      // Hijau Emerald
  'PAUD': 'rgba(236, 72, 153, 0.85)',    // Pink Rose
  'TK': 'rgba(244, 63, 94, 0.85)',       // Merah Muda
  'KB': 'rgba(217, 70, 239, 0.85)',      // Fuchsia
  'TPA': 'rgba(168, 85, 247, 0.85)',     // Ungu
  'SPS': 'rgba(139, 92, 246, 0.85)',     // Violet
  'RA': 'rgba(20, 184, 166, 0.85)',      // Toska
  'MI': 'rgba(14, 165, 233, 0.85)',      // Biru Langit
  'MTS': 'rgba(6, 182, 212, 0.85)',      // Cyan
  'SLB': 'rgba(132, 204, 22, 0.85)',     // Hijau Lime
  'PKBM': 'rgba(234, 88, 12, 0.85)',     // Oranye Tua
  'SKB': 'rgba(100, 116, 139, 0.85)'     // Slate
};

const FALLBACK_JENJANG_COLORS = [
  'rgba(14, 165, 233, 0.85)',
  'rgba(236, 72, 153, 0.85)',
  'rgba(20, 184, 166, 0.85)',
  'rgba(168, 85, 247, 0.85)',
  'rgba(234, 88, 12, 0.85)',
  'rgba(132, 204, 22, 0.85)',
  'rgba(100, 116, 139, 0.85)'
];

/**
 * Mengisi pilihan jenjang pada dropdown filter cetak laporan secara dinamis
 */
function populateJenjangDropdown() {
  const selectPrintJenjang = document.getElementById('printFilterJenjang');
  if (!selectPrintJenjang) return;
  const currentVal = selectPrintJenjang.value || 'ALL';

  const uniqueJenjangSet = new Set();
  (APP_STATE.items || []).forEach(function (item) {
    const j = (item.jenjang || '').trim().toUpperCase();
    if (j) uniqueJenjangSet.add(j);
  });

  const uniqueJenjangList = Array.from(uniqueJenjangSet);
  if (typeof STANDARD_JENJANG_ORDER !== 'undefined') {
    uniqueJenjangList.sort(function (a, b) {
      const idxA = STANDARD_JENJANG_ORDER.indexOf(a);
      const idxB = STANDARD_JENJANG_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  } else {
    uniqueJenjangList.sort();
  }

  let optionsHtml = '<option value="ALL">Semua Jenjang Pendidikan</option>';
  uniqueJenjangList.forEach(function (j) {
    optionsHtml += '<option value="' + j + '">Jenjang ' + j + '</option>';
  });

  selectPrintJenjang.innerHTML = optionsHtml;
  if (uniqueJenjangSet.has(currentVal)) {
    selectPrintJenjang.value = currentVal;
  } else {
    selectPrintJenjang.value = 'ALL';
  }
}

/**
 * Mengisi dropdown asesor pada tab Dashboard dan tab Cetak, serta inisialisasi filter wilayah
 */
function populateAsesorDropdowns() {
  const selectDash = document.getElementById('selectAsesor');
  const selectPrint = document.getElementById('printFilterAsesor');
  const selectWil = document.getElementById('filterWilayah');
  const searchInp = document.getElementById('searchAsesorInput');
  const searchQuery = (searchInp ? searchInp.value : '').trim().toLowerCase();
  const currentSelected = APP_STATE.selectedAsesorId;

  // Inisialisasi Pilihan Wilayah Unik: HANYA Kolom E (Kab/Kota Satuan Pendidikan)
  if (selectWil) {
    const curWil = selectWil.value || 'ALL';
    const wilSet = new Set();
    APP_STATE.items.forEach(function (it) {
      if (it.kabSekolah && it.kabSekolah.trim()) {
        wilSet.add(it.kabSekolah.trim().toUpperCase());
      }
    });
    selectWil.innerHTML = '<option value="ALL">Lintas Wilayah</option>';
    Array.from(wilSet).filter(Boolean).sort().forEach(function (w) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      if (w === curWil) opt.selected = true;
      selectWil.appendChild(opt);
    });
  }

  // Reset options
  if (selectDash) {
    selectDash.innerHTML = '<option value="ALL">-- Seluruh Asesor (' + (searchQuery ? 'Hasil Pencarian' : 'Tinjauan Global') + ') --</option>';
  }
  if (selectPrint) {
    selectPrint.innerHTML = '<option value="ALL">Semua Asesor (Laporan Lengkap)</option>';
  }

  APP_STATE.daftarAsesor.forEach(function (a) {
    const optText = a.nama + ' (NIA: ' + (a.nia || '-') + ' | ' + a.kabupaten + ') - ' + a.totalTugas + ' Sekolah';

    if (selectDash) {
      const matchQuery = !searchQuery || (a.nama || '').toLowerCase().includes(searchQuery) || (a.nia || '').toLowerCase().includes(searchQuery);
      if (matchQuery) {
        const opt1 = document.createElement('option');
        opt1.value = a.id;
        opt1.textContent = optText;
        if (a.id === currentSelected) opt1.selected = true;
        selectDash.appendChild(opt1);
      }
    }

    if (selectPrint) {
      const opt2 = document.createElement('option');
      opt2.value = a.id;
      opt2.textContent = a.nama + ' (' + a.kabupaten + ')';
      selectPrint.appendChild(opt2);
    }
  });
}

/**
 * Pencarian Real-Time pada Dropdown Pilih Asesor
 */
function onSearchAsesorInput(query) {
  const selectDash = document.getElementById('selectAsesor');
  const btnClear = document.getElementById('btnClearAsesorSearch');
  if (!selectDash) return;

  const q = (query || '').trim().toLowerCase();
  if (btnClear) {
    btnClear.style.display = q.length > 0 ? 'inline-block' : 'none';
  }

  const curVal = selectDash.value;

  // Filter daftar asesor berdasarkan nama atau NIA
  const filtered = APP_STATE.daftarAsesor.filter(function (a) {
    if (!q) return true;
    const nameMatch = (a.nama || '').toLowerCase().includes(q);
    const niaMatch = (a.nia || '').toLowerCase().includes(q);
    return nameMatch || niaMatch;
  });

  // Perbarui opsi dropdown
  selectDash.innerHTML = '<option value="ALL">-- Seluruh Asesor (' + (q ? filtered.length + ' Ditemukan' : 'Tinjauan Global') + ') --</option>';

  let stillExists = false;
  filtered.forEach(function (a) {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nama + ' (NIA: ' + (a.nia || '-') + ' | ' + a.kabupaten + ') - ' + a.totalTugas + ' Sekolah';
    if (a.id === curVal) {
      opt.selected = true;
      stillExists = true;
    }
    selectDash.appendChild(opt);
  });

  // Jika asesor yang sebelumnya dipilih tidak ada dalam hasil pencarian, reset ke ALL
  if (!stillExists && curVal !== 'ALL') {
    selectDash.value = 'ALL';
    APP_STATE.selectedAsesorId = 'ALL';
    updateDynamicDashboard();
  }
}

/**
 * Menghapus kata kunci pencarian asesor dan mengembalikan daftar dropdown
 */
function clearAsesorSearch() {
  const inp = document.getElementById('searchAsesorInput');
  if (inp) {
    inp.value = '';
    onSearchAsesorInput('');
    inp.focus();
  }
}

/**
 * Handler saat pilihan dropdown asesor diubah
 */
function onAsesorFilterChange() {
  APP_STATE.dashboardPage = 1;
  const selectEl = document.getElementById('selectAsesor');
  const val = selectEl ? selectEl.value : 'ALL';
  APP_STATE.selectedAsesorId = val;

  if (val !== 'ALL') {
    const asesor = APP_STATE.daftarAsesor.find(function (a) { return a.id === val; });
    if (asesor) {
      const elPeran = document.getElementById('filterPeran');
      if (elPeran) elPeran.value = asesor.peran;
    }
  }
  updateDynamicDashboard();
}

/**
 * Kontrol & Logika Multi-Select Filter Tahap (Dashboard)
 */
function matchTahap(itemTahap, selectedTahaps) {
  if (!selectedTahaps || selectedTahaps.length === 0 || selectedTahaps.includes('ALL')) return true;
  const raw = String(itemTahap || '').trim().toLowerCase();
  const numMatch = raw.match(/\d+/);
  const num = numMatch ? numMatch[0] : '';

  for (let i = 0; i < selectedTahaps.length; i++) {
    const sel = String(selectedTahaps[i] || '').trim().toLowerCase();
    if (sel === 'all') return true;
    if (sel === raw) return true;
    const selNumMatch = sel.match(/\d+/);
    const selNum = selNumMatch ? selNumMatch[0] : '';
    if (num && selNum && num === selNum) return true;
  }
  return false;
}

function getSelectedTahapFilters() {
  const chkAll = document.getElementById('chkTahapAll');
  if (chkAll && chkAll.checked) {
    return ['ALL'];
  }
  const itemCheckboxes = document.querySelectorAll('.chk-tahap-item:checked');
  const totalItems = document.querySelectorAll('.chk-tahap-item').length;
  if (itemCheckboxes.length === 0 || itemCheckboxes.length === totalItems) {
    return ['ALL'];
  }
  const selected = [];
  itemCheckboxes.forEach(function (chk) {
    selected.push(chk.value);
  });
  return selected;
}

function toggleTahapDropdown(e) {
  if (e) {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  }
  const menu = document.getElementById('tahapDropdownMenu');
  const wrapper = document.getElementById('pillTahapWrapper');
  const btn = document.getElementById('btnTahapDropdown');
  if (!menu) return;

  const isShown = menu.classList.contains('show');
  if (isShown) {
    closeTahapDropdown();
  } else {
    // Tutup dropdown lain jika terbuka
    if (typeof closeAllDropdowns === 'function') closeAllDropdowns();
    menu.classList.add('show');
    if (wrapper) wrapper.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function closeTahapDropdown() {
  const menu = document.getElementById('tahapDropdownMenu');
  const wrapper = document.getElementById('pillTahapWrapper');
  const btn = document.getElementById('btnTahapDropdown');
  if (menu) menu.classList.remove('show');
  if (wrapper) wrapper.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function updateTahapDropdownLabel() {
  const labelEl = document.getElementById('filterTahapLabel');
  const hiddenInput = document.getElementById('filterTahap');
  const chkAll = document.getElementById('chkTahapAll');
  const itemCheckboxes = document.querySelectorAll('.chk-tahap-item:checked');

  if (!labelEl) return;

  if (chkAll && chkAll.checked) {
    labelEl.textContent = 'Semua Tahap';
    if (hiddenInput) hiddenInput.value = 'ALL';
    return;
  }

  const totalItems = document.querySelectorAll('.chk-tahap-item').length;
  if (itemCheckboxes.length === 0 || itemCheckboxes.length === totalItems) {
    if (chkAll) chkAll.checked = true;
    document.querySelectorAll('.chk-tahap-item').forEach(function (c) { c.checked = false; });
    labelEl.textContent = 'Semua Tahap';
    if (hiddenInput) hiddenInput.value = 'ALL';
    return;
  }

  const vals = [];
  itemCheckboxes.forEach(function (c) { vals.push(c.value); });

  let displayLabel = '';
  if (vals.length === 1) {
    displayLabel = vals[0];
  } else if (vals.length === 2) {
    const n1 = vals[0].replace('Tahap ', '');
    const n2 = vals[1].replace('Tahap ', '');
    displayLabel = 'Tahap ' + n1 + ', ' + n2;
  } else if (vals.length === 3) {
    const n1 = vals[0].replace('Tahap ', '');
    const n2 = vals[1].replace('Tahap ', '');
    const n3 = vals[2].replace('Tahap ', '');
    displayLabel = 'Tahap ' + n1 + ', ' + n2 + ', ' + n3;
  } else {
    displayLabel = vals.length + ' Tahap';
  }

  labelEl.textContent = displayLabel;
  if (hiddenInput) hiddenInput.value = vals.join(', ');
}

function onTahapAllToggle(el) {
  if (el.checked) {
    document.querySelectorAll('.chk-tahap-item').forEach(function (c) {
      c.checked = false;
    });
  } else {
    const anyChecked = document.querySelectorAll('.chk-tahap-item:checked').length > 0;
    if (!anyChecked) {
      el.checked = true;
    }
  }
  updateTahapDropdownLabel();
  onUnifiedFilterChange();
}

function onTahapItemToggle() {
  const chkAll = document.getElementById('chkTahapAll');
  const itemCheckboxes = document.querySelectorAll('.chk-tahap-item:checked');
  const totalItems = document.querySelectorAll('.chk-tahap-item').length;

  if (chkAll) {
    if (itemCheckboxes.length > 0 && itemCheckboxes.length < totalItems) {
      chkAll.checked = false;
    } else {
      chkAll.checked = true;
      document.querySelectorAll('.chk-tahap-item').forEach(function (c) { c.checked = false; });
    }
  }

  updateTahapDropdownLabel();
  onUnifiedFilterChange();
}

function resetTahapMultiSelect() {
  const chkAll = document.getElementById('chkTahapAll');
  if (chkAll) chkAll.checked = true;
  document.querySelectorAll('.chk-tahap-item').forEach(function (c) {
    c.checked = false;
  });
  const labelEl = document.getElementById('filterTahapLabel');
  if (labelEl) labelEl.textContent = 'Semua Tahap';
  const hiddenInput = document.getElementById('filterTahap');
  if (hiddenInput) hiddenInput.value = 'ALL';
  closeTahapDropdown();
}

/**
 * Handler saat salah satu filter pill diubah
 */
function onUnifiedFilterChange() {
  APP_STATE.dashboardPage = 1;
  updateDynamicDashboard();
}

/**
 * Mengembalikan seluruh filter dashboard ke posisi default
 */
function resetDashboardFilters() {
  const resetBtn = document.querySelector('.btn-reset-filters');
  if (resetBtn) {
    resetBtn.classList.add('is-resetting');
    setTimeout(function () {
      resetBtn.classList.remove('is-resetting');
    }, 550);
  }
  APP_STATE.dashboardPage = 1;
  const searchInp = document.getElementById('searchAsesorInput');
  if (searchInp) searchInp.value = '';
  const btnClear = document.getElementById('btnClearAsesorSearch');
  if (btnClear) btnClear.style.display = 'none';
  onSearchAsesorInput('');

  if (document.getElementById('selectAsesor')) document.getElementById('selectAsesor').value = 'ALL';
  if (document.getElementById('filterPeran')) document.getElementById('filterPeran').value = 'ALL';
  if (document.getElementById('filterWilayah')) document.getElementById('filterWilayah').value = 'ALL';
  if (document.getElementById('filterBeban')) document.getElementById('filterBeban').value = 'ALL';
  if (document.getElementById('filterProgres')) document.getElementById('filterProgres').value = 'ALL';
  if (typeof resetTahapMultiSelect === 'function') {
    resetTahapMultiSelect();
  } else if (document.getElementById('filterTahap')) {
    document.getElementById('filterTahap').value = 'ALL';
  }
  APP_STATE.selectedAsesorId = 'ALL';
  updateDynamicDashboard();
  showToast('Seluruh filter telah di-reset ke tampilan awal');
}

/**
 * Mengembalikan seluruh filter sistem di semua tab (Dashboard, Data Penilaian, Cetak, Penugasan)
 * ke kondisi awal (default/bersih) saat Logout atau Login kembali (v1.0.58)
 */
function resetAllSystemFilters() {
  // 1. Reset Filter Tab 1: Dashboard
  APP_STATE.dashboardPage = 1;
  const searchInp = document.getElementById('searchAsesorInput');
  if (searchInp) searchInp.value = '';
  const btnClear = document.getElementById('btnClearAsesorSearch');
  if (btnClear) btnClear.style.display = 'none';
  if (typeof onSearchAsesorInput === 'function') onSearchAsesorInput('');

  if (document.getElementById('selectAsesor')) document.getElementById('selectAsesor').value = 'ALL';
  if (document.getElementById('filterPeran')) document.getElementById('filterPeran').value = 'ALL';
  if (document.getElementById('filterWilayah')) document.getElementById('filterWilayah').value = 'ALL';
  if (document.getElementById('filterBeban')) document.getElementById('filterBeban').value = 'ALL';
  if (document.getElementById('filterProgres')) document.getElementById('filterProgres').value = 'ALL';
  if (typeof resetTahapMultiSelect === 'function') {
    resetTahapMultiSelect();
  } else if (document.getElementById('filterTahap')) {
    document.getElementById('filterTahap').value = 'ALL';
  }
  APP_STATE.selectedAsesorId = 'ALL';

  // 2. Reset Filter Tab 2: Data Penilaian Lengkap
  const searchFull = document.getElementById('searchInput');
  if (searchFull) searchFull.value = '';
  const filterDataTahap = document.getElementById('filterDataTahap');
  if (filterDataTahap) filterDataTahap.value = 'ALL';
  APP_STATE.currentFilterFull = 'ALL';
  APP_STATE.fullTablePage = 1;

  const filterBtns = document.querySelectorAll('.table-toolbar .filter-btn');
  filterBtns.forEach(function (b) {
    if (b.getAttribute('href') === '#status-all') {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // 3. Reset Filter Tab 3: Cetak Dokumen Resmi
  if (document.getElementById('printFormatDokumen')) document.getElementById('printFormatDokumen').value = 'LENGKAP';
  if (document.getElementById('printFilterAsesor')) document.getElementById('printFilterAsesor').value = 'ALL';
  if (document.getElementById('printFilterJenjang')) document.getElementById('printFilterJenjang').value = 'ALL';
  if (document.getElementById('printFilterStatus')) document.getElementById('printFilterStatus').value = 'ALL';
  if (document.getElementById('printFilterTahap')) document.getElementById('printFilterTahap').value = 'ALL';

  // 4. Reset Filter Tab 4: Penugasan Asesor
  const penugasanSearch = document.getElementById('penugasanSearchInput');
  if (penugasanSearch) penugasanSearch.value = '';
  if (document.getElementById('penugasanSelectAsesor')) document.getElementById('penugasanSelectAsesor').value = 'ALL';
  if (document.getElementById('penugasanFilterTahap')) document.getElementById('penugasanFilterTahap').value = 'ALL';
  if (document.getElementById('penugasanFilterWilayah')) document.getElementById('penugasanFilterWilayah').value = 'ALL';

  // 5. Kembalikan Posisi Navigasi ke Tab Beranda (Dashboard)
  if (typeof switchTab === 'function') {
    switchTab('dashboard');
  }

  // 6. Sinkronisasi Perenderan Seluruh Komponen Tampilan
  if (typeof updateDynamicDashboard === 'function') updateDynamicDashboard();
  if (typeof renderFullTable === 'function') renderFullTable();
  if (typeof renderPrintPreview === 'function') renderPrintPreview();
  if (typeof renderPenugasanData === 'function') renderPenugasanData();
}

/**
 * Memperbarui seluruh visualisasi dinamis berdasarkan kombinasi filter
 */
function updateDynamicDashboard() {
  const selectAsesorEl = document.getElementById('selectAsesor');
  let asesorId = selectAsesorEl ? selectAsesorEl.value : 'ALL';
  APP_STATE.selectedAsesorId = asesorId;

  const fPeran = document.getElementById('filterPeran') ? document.getElementById('filterPeran').value : 'ALL';
  const fWilayah = document.getElementById('filterWilayah') ? document.getElementById('filterWilayah').value : 'ALL';
  const fBeban = document.getElementById('filterBeban') ? document.getElementById('filterBeban').value : 'ALL';
  const fProgres = document.getElementById('filterProgres') ? document.getElementById('filterProgres').value : 'ALL';
  const selectedTahaps = typeof getSelectedTahapFilters === 'function' ? getSelectedTahapFilters() : ['ALL'];
  const isTahapFiltered = (selectedTahaps.length > 0 && !selectedTahaps.includes('ALL'));

  // Peta cepat asesor berdasarkan ID/NIA untuk pengecekan Peran dan Beban
  const asesorMapById = {};
  (APP_STATE.daftarAsesor || []).forEach(function (a) {
    if (a.id) asesorMapById[a.id] = a;
    if (a.nia && a.nia !== '-') asesorMapById[a.nia.toUpperCase()] = a;
  });

  const hasFilter = (asesorId !== 'ALL' || fPeran !== 'ALL' || fWilayah !== 'ALL' || fBeban !== 'ALL' || fProgres !== 'ALL' || isTahapFiltered);

  // Filter target sekolah dengan evaluasi menyeluruh
  let targetSchools = (APP_STATE.items || []).filter(function (item) {
    // 1. Filter Tahap (Mendukung Multi-Select pilihan lebih dari 1 tahap dengan pencocokan cerdas)
    if (isTahapFiltered && !matchTahap(item.tahap, selectedTahaps)) return false;

    // 2. Filter Wilayah (Kolom E: Kab/Kota Satuan Pendidikan)
    if (fWilayah !== 'ALL') {
      if (!item.kabSekolah || item.kabSekolah.trim().toUpperCase() !== fWilayah.toUpperCase()) return false;
    }

    // Identifikasi penugasan Asesor 1 dan Asesor 2 pada sekolah ini
    const id1 = (item.namaAsesor1 || '').trim().toUpperCase();
    const nia1 = (item.nia1 || '').trim().toUpperCase();
    const id2 = (item.namaAsesor2 || '').trim().toUpperCase();
    const nia2 = (item.nia2 || '').trim().toUpperCase();

    const isA1 = (asesorId !== 'ALL') && (id1 === asesorId || (nia1 && nia1 === asesorId));
    const isA2 = (asesorId !== 'ALL') && (id2 === asesorId || (nia2 && nia2 === asesorId));

    // 3. Filter Asesor Terpilih
    if (asesorId !== 'ALL' && !isA1 && !isA2) {
      return false;
    }

    // 4. Filter Peran
    if (fPeran !== 'ALL') {
      if (asesorId !== 'ALL') {
        if (fPeran === 'Asesor 1' && !isA1) return false;
        if (fPeran === 'Asesor 2' && !isA2) return false;
        if (fPeran === 'Asesor 1 & 2' && (!isA1 && !isA2)) return false;
      } else {
        const a1Obj = asesorMapById[id1] || asesorMapById[nia1];
        const a2Obj = asesorMapById[id2] || asesorMapById[nia2];
        const matchRole = function (obj, role) {
          if (!obj) return false;
          if (role === 'Asesor 1') return obj.peran === 'Asesor 1' || obj.peran === 'Asesor 1 & 2';
          if (role === 'Asesor 2') return obj.peran === 'Asesor 2' || obj.peran === 'Asesor 1 & 2';
          if (role === 'Asesor 1 & 2') return obj.peran === 'Asesor 1 & 2';
          return true;
        };
        if (!matchRole(a1Obj, fPeran) && !matchRole(a2Obj, fPeran)) return false;
      }
    }

    // 5. Filter Beban Tugas
    if (fBeban !== 'ALL') {
      const checkBeban = function (tugas) {
        if (fBeban === '1-2') return tugas >= 1 && tugas <= 2;
        if (fBeban === '3-4') return tugas >= 3 && tugas <= 4;
        if (fBeban === '5+') return tugas >= 5;
        return true;
      };

      if (asesorId !== 'ALL') {
        const selObj = asesorMapById[asesorId];
        if (selObj && !checkBeban(selObj.totalTugas)) return false;
      } else {
        const a1Obj = asesorMapById[id1] || asesorMapById[nia1];
        const a2Obj = asesorMapById[id2] || asesorMapById[nia2];
        const a1Ok = a1Obj && checkBeban(a1Obj.totalTugas);
        const a2Ok = a2Obj && checkBeban(a2Obj.totalTugas);
        if (!a1Ok && !a2Ok) return false;
      }
    }

    // 6. Filter Progres (Evaluasi Status Penilaian Riil pada Sekolah Ini)
    if (fProgres !== 'ALL') {
      let sCount = 0;
      let tCount = 0;

      if (asesorId !== 'ALL') {
        // Evaluasi beban tanggung jawab asesor yang sedang dipilih
        if (isA1) {
          tCount += 2;
          if (item.status1 === 'SELESAI') sCount++;
          if (item.statusKelompok === 'SELESAI') sCount++;
        }
        if (isA2) {
          tCount += 1;
          if (item.status2 === 'SELESAI') sCount++;
        }
      } else {
        // Tinjauan global: 3 instrumen penilaian satuan pendidikan
        tCount = 3;
        if (item.status1 === 'SELESAI') sCount++;
        if (item.statusKelompok === 'SELESAI') sCount++;
        if (item.status2 === 'SELESAI') sCount++;
      }

      if (fProgres === '100') {
        // Selesai (100%): seluruh penilaian harus SELESAI
        if (sCount < tCount || tCount === 0) return false;
      } else if (fProgres === 'UNDER_100') {
        // Belum Selesai (< 100%): masih ada penilaian yang belum SELESAI
        if (sCount === tCount) return false;
      } else if (fProgres === '0') {
        // Belum Ada Nilai (0%): tidak ada satupun penilaian yang SELESAI
        if (sCount > 0) return false;
      }
    }

    return true;
  });

  // Hitung metrik Donut & Bar Chart serta Asesor Terlibat
  let selesaiCount = 0;
  let belumCount = 0;
  const jenjangCounts = {};
  const activeAsesorSet = new Set();

  if (asesorId !== 'ALL') {
    const asesor = APP_STATE.daftarAsesor.find(function (a) { return a.id === asesorId; });
    const namaAsesor = asesor ? asesor.nama : asesorId;
    document.getElementById('chart1Title').textContent = 'Progres Penilaian: ' + namaAsesor;
    document.getElementById('chart2Title').textContent = 'Beban Sekolah per Jenjang: ' + namaAsesor;

    targetSchools.forEach(function (item) {
      const id1 = (item.namaAsesor1 || '').trim().toUpperCase();
      const nia1 = (item.nia1 || '').trim().toUpperCase();
      const id2 = (item.namaAsesor2 || '').trim().toUpperCase();
      const nia2 = (item.nia2 || '').trim().toUpperCase();

      const isA1 = (id1 === asesorId || (nia1 && nia1 === asesorId));
      const isA2 = (id2 === asesorId || (nia2 && nia2 === asesorId));

      // Asesor 1: Menilai Nilai Asesor 1 dan Nilai Kelompok (2 penilaian)
      if (isA1) {
        if (item.status1 === 'SELESAI') selesaiCount++; else belumCount++;
        if (item.statusKelompok === 'SELESAI') selesaiCount++; else belumCount++;
      }
      // Asesor 2: Hanya Menilai Nilai Asesor 2 (1 penilaian)
      if (isA2) {
        if (item.status2 === 'SELESAI') selesaiCount++; else belumCount++;
      }

      const j = (item.jenjang || 'Lainnya').trim().toUpperCase();
      if (j) {
        jenjangCounts[j] = (jenjangCounts[j] || 0) + 1;
      }
    });
  } else {
    if (hasFilter) {
      document.getElementById('chart1Title').textContent = 'Progres Penilaian (Hasil Filter: ' + targetSchools.length + ' Sekolah)';
      document.getElementById('chart2Title').textContent = 'Distribusi Jenjang (Hasil Filter)';
    } else {
      document.getElementById('chart1Title').textContent = 'Status Progres Keseluruhan Penilaian';
      document.getElementById('chart2Title').textContent = 'Distribusi Seluruh Jenjang Sekolah';
    }

    targetSchools.forEach(function (item) {
      // Asesor 1: Menilai Nilai Asesor 1 dan Nilai Kelompok (2 penilaian)
      if (item.status1 === 'SELESAI') selesaiCount++; else belumCount++;
      if (item.statusKelompok === 'SELESAI') selesaiCount++; else belumCount++;
      // Asesor 2: Hanya Menilai Nilai Asesor 2 (1 penilaian)
      if (item.status2 === 'SELESAI') selesaiCount++; else belumCount++;

      if (item.namaAsesor1 && item.namaAsesor1.trim()) activeAsesorSet.add(item.namaAsesor1.trim().toUpperCase());
      if (item.namaAsesor2 && item.namaAsesor2.trim()) activeAsesorSet.add(item.namaAsesor2.trim().toUpperCase());

      const j = (item.jenjang || 'Lainnya').trim().toUpperCase();
      if (j) {
        jenjangCounts[j] = (jenjangCounts[j] || 0) + 1;
      }
    });
  }

  // Perbarui Tampilan Kartu Ringkasan (KPI Cards) Secara Dinamis Mengikuti Filter
  const totalTugasTarget = selesaiCount + belumCount;
  const pctTarget = totalTugasTarget > 0 ? Math.round((selesaiCount / totalTugasTarget) * 100) : 0;

  const elTotalSekolah = document.getElementById('kpiTotalSekolah');
  const elTotalAsesor = document.getElementById('kpiTotalAsesor');
  const elTotalSelesai = document.getElementById('kpiTotalSelesai');
  const elTotalBelum = document.getElementById('kpiTotalBelum');
  const elPersenSelesai = document.getElementById('kpiPersenSelesai');
  const elSekolahSub = document.getElementById('kpiSekolahSub');
  const elAsesorSub = document.getElementById('kpiAsesorSub');

  if (elTotalSekolah) animateCounter(elTotalSekolah, targetSchools.length, 650);
  if (elTotalSelesai) animateCounter(elTotalSelesai, selesaiCount, 650);
  if (elTotalBelum) animateCounter(elTotalBelum, belumCount, 650);
  if (elPersenSelesai) animateCounter(elPersenSelesai, pctTarget, 750, '%');

  if (asesorId !== 'ALL') {
    if (elTotalAsesor) animateCounter(elTotalAsesor, targetSchools.length > 0 ? 1 : 0, 650);
    if (elSekolahSub) elSekolahSub.textContent = 'Sekolah Ditugaskan';
    if (elAsesorSub) elAsesorSub.textContent = 'Asesor Terpilih';
  } else {
    if (elTotalAsesor) animateCounter(elTotalAsesor, activeAsesorSet.size, 650);
    if (elSekolahSub) elSekolahSub.textContent = hasFilter ? 'Sekolah Hasil Filter' : 'Satuan Pendidikan';
    if (elAsesorSub) elAsesorSub.textContent = hasFilter ? 'Asesor Terlibat' : 'Tim Penilai 1 & 2';
  }

  // Perbarui Tampilan Grafik & Tabel
  renderDonutChart(selesaiCount, belumCount);
  renderBarChart(jenjangCounts);
  renderDashboardTable(targetSchools);
}

/**
 * Render Grafik Donut 3D (SELESAI vs BELUM)
 * Format Pseudo-3D Depth Ring dengan Multi-stop Gradient & Embossed Metric Core
 */
function renderDonutChart(selesai, belum) {
  const canvasEl = document.getElementById('chartDonutProgres');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const total = selesai + belum;
  const pctSelesai = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const pctBelum = total > 0 ? (100 - pctSelesai) : 0;

  if (APP_STATE.chartDonutInstance) {
    APP_STATE.chartDonutInstance.destroy();
  }

  // Gradasi 3D Multi-Stop untuk Selesai (Emerald Mint) dan Belum Selesai (Sunset Coral)
  const gradSelesai = ctx.createLinearGradient(0, 20, 0, 260);
  gradSelesai.addColorStop(0, '#34d399');   // Highlight atas berkilau
  gradSelesai.addColorStop(0.45, '#10b981'); // Badan hijau zamrud utama
  gradSelesai.addColorStop(1, '#047857');   // Bayangan bawah pekat

  const gradBelum = ctx.createLinearGradient(0, 20, 0, 260);
  gradBelum.addColorStop(0, '#fb7185');   // Highlight atas karang lembut
  gradBelum.addColorStop(0.45, '#f43f5e'); // Badan rose coral utama
  gradBelum.addColorStop(1, '#be123c');   // Bayangan bawah pekat

  // Hover Gradients
  const gradSelesaiHover = ctx.createLinearGradient(0, 20, 0, 260);
  gradSelesaiHover.addColorStop(0, '#6ee7b7');
  gradSelesaiHover.addColorStop(1, '#059669');

  const gradBelumHover = ctx.createLinearGradient(0, 20, 0, 260);
  gradBelumHover.addColorStop(0, '#fda4af');
  gradBelumHover.addColorStop(1, '#e11d48');

  // Plugin 1: 3D Ambient Drop Shadow di Bawah Cincin Donut
  const doughnut3DShadowPlugin = {
    id: 'doughnut3DShadowPlugin',
    beforeDatasetDraw: function (chart, args) {
      if (args.index !== 0) return;
      const chartCtx = chart.ctx;
      chartCtx.save();
      chartCtx.shadowColor = 'rgba(15, 23, 42, 0.22)';
      chartCtx.shadowBlur = 14;
      chartCtx.shadowOffsetX = 0;
      chartCtx.shadowOffsetY = 8;
    },
    afterDatasetDraw: function (chart, args) {
      if (args.index !== 0) return;
      chart.ctx.restore();
    }
  };

  // Plugin 2: Center Pod 3D Embossed (Lingkaran Metrik Timbul di Tengah Donut)
  const centerPodPlugin = {
    id: 'centerPodPlugin',
    afterDatasetsDraw: function (chart) {
      const chartArea = chart.chartArea;
      if (!chartArea) return;
      const chartCtx = chart.ctx;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      let innerR = 64;
      const meta = chart.getDatasetMeta(0);
      if (meta && meta.controller && typeof meta.controller.innerRadius === 'number') {
        innerR = Math.max(meta.controller.innerRadius - 6, 40);
      }

      chartCtx.save();

      // 1. Gambar Piringan Timbul 3D (Embossed Plate)
      chartCtx.beginPath();
      chartCtx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
      const plateGrad = chartCtx.createRadialGradient(centerX - 10, centerY - 12, 6, centerX, centerY, innerR);
      plateGrad.addColorStop(0, '#ffffff');
      plateGrad.addColorStop(0.85, '#f8fafc');
      plateGrad.addColorStop(1, '#e2e8f0');
      chartCtx.fillStyle = plateGrad;
      chartCtx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      chartCtx.shadowBlur = 8;
      chartCtx.shadowOffsetX = 0;
      chartCtx.shadowOffsetY = 3;
      chartCtx.fill();

      chartCtx.shadowColor = 'transparent';
      chartCtx.lineWidth = 1.5;
      chartCtx.strokeStyle = '#e2e8f0';
      chartCtx.stroke();

      // 2. Angka Persentase Utama
      chartCtx.font = '800 28px Outfit, Inter, sans-serif';
      chartCtx.fillStyle = '#0f172a';
      chartCtx.textAlign = 'center';
      chartCtx.textBaseline = 'middle';
      chartCtx.fillText(pctSelesai + '%', centerX, centerY - 10);

      // 3. Kapsul Status Lencana (Status Badge Pill)
      const isAllDone = (pctSelesai === 100);
      const badgeText = isAllDone ? 'TUNTAS' : (pctSelesai > 0 ? 'SELESAI' : 'BELUM');
      const badgeBg = isAllDone ? '#dcfce7' : (pctSelesai > 0 ? '#ecfdf5' : '#fee2e2');
      const badgeColor = isAllDone ? '#15803d' : (pctSelesai > 0 ? '#047857' : '#b91c1c');
      const badgeBorder = isAllDone ? '#86efac' : (pctSelesai > 0 ? '#a7f3d0' : '#fecaca');

      const pillW = 68;
      const pillH = 18;
      const pillX = centerX - (pillW / 2);
      const pillY = centerY + 9;
      const pillR = 9;

      chartCtx.beginPath();
      if (typeof chartCtx.roundRect === 'function') {
        chartCtx.roundRect(pillX, pillY, pillW, pillH, pillR);
      } else {
        chartCtx.rect(pillX, pillY, pillW, pillH);
      }
      chartCtx.fillStyle = badgeBg;
      chartCtx.fill();
      chartCtx.lineWidth = 1;
      chartCtx.strokeStyle = badgeBorder;
      chartCtx.stroke();

      chartCtx.font = '700 9.5px Inter, sans-serif';
      chartCtx.fillStyle = badgeColor;
      chartCtx.textAlign = 'center';
      chartCtx.textBaseline = 'middle';
      chartCtx.fillText(badgeText, centerX, pillY + (pillH / 2));

      chartCtx.restore();
    }
  };

  // Positioner khusus agar notifikasi selalu berada di luar cincin donat (ruang lapang kiri/kanan)
  if (typeof Chart !== 'undefined' && Chart.Tooltip && Chart.Tooltip.positioners) {
    Chart.Tooltip.positioners.doughnutOutside = function (items, eventPosition) {
      if (!items || !items.length) return false;
      const chart = this.chart;
      const chartArea = chart.chartArea;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      const element = items[0].element;
      if (!element) return eventPosition;

      const midAngle = (element.startAngle + element.endAngle) / 2;
      const outerR = element.outerRadius || 90;

      // Arahkan ke sisi luar cincin (kanan atau kiri sesuai posisi irisan)
      const isRight = Math.cos(midAngle) >= 0;
      const targetX = isRight ? (centerX + outerR + 14) : (centerX - outerR - 14);
      const targetY = centerY + Math.sin(midAngle) * (outerR * 0.5);

      return {
        x: Math.max(chartArea.left + 55, Math.min(chartArea.right - 55, targetX)),
        y: Math.max(chartArea.top + 20, Math.min(chartArea.bottom - 20, targetY))
      };
    };
  }

  APP_STATE.chartDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['SELESAI (' + pctSelesai + '%)', 'BELUM SELESAI (' + pctBelum + '%)'],
      datasets: [{
        data: [selesai, belum],
        backgroundColor: [gradSelesai, gradBelum],
        hoverBackgroundColor: [gradSelesaiHover, gradBelumHover],
        borderWidth: 2.5,
        borderColor: '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 900,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: { top: 10, bottom: 8, left: 10, right: 10 }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            borderRadius: 4,
            useBorderRadius: true,
            padding: 14,
            font: { family: 'Inter', size: 12, weight: 700 },
            color: '#334155'
          }
        },
        tooltip: {
          position: 'doughnutOutside',
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          borderWidth: 1,
          titleFont: { family: 'Outfit', size: 11, weight: 700 },
          bodyFont: { family: 'Inter', size: 11, weight: 600 },
          padding: { top: 6, bottom: 6, left: 10, right: 10 },
          cornerRadius: 8,
          caretSize: 5,
          caretPadding: 6,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          titleMarginBottom: 4,
          callbacks: {
            title: function (items) {
              if (!items || !items.length) return '';
              const rawLabel = items[0].label || '';
              return rawLabel.split(' (')[0].trim();
            },
            label: function (ctx) {
              const val = ctx.raw || 0;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ' ' + Number(val).toLocaleString('id-ID') + ' Sekolah (' + pct + '%)';
            }
          }
        }
      },
      cutout: '66%'
    },
    plugins: [doughnut3DShadowPlugin, centerPodPlugin]
  });
}

/**
 * Render Grafik Batang 3D (Distribusi Jenjang Sekolah dengan Gradasi Kolom 3D & Floating Labels)
 */
function renderBarChart(jenjangCounts) {
  const canvasEl = document.getElementById('chartBarJenjang');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');

  // Ambil seluruh jenjang yang terdeteksi pada dataset
  let labels = Object.keys(jenjangCounts || {}).filter(function (k) {
    return jenjangCounts[k] > 0;
  });

  // Jika belum ada data sama sekali, tampilkan default jenjang standar
  if (labels.length === 0) {
    labels = ['SD', 'SMP', 'SMA', 'SMK', 'MA'];
  } else {
    // Urutkan label mengikuti hierarki pendidikan formal & nonformal baku
    labels.sort(function (a, b) {
      const idxA = STANDARD_JENJANG_ORDER.indexOf(a);
      const idxB = STANDARD_JENJANG_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // Perbarui teks badge di header kartu diagram secara dinamis
  const badgeEl = document.getElementById('chart2Badge');
  if (badgeEl) {
    if (labels.length > 0 && labels.length <= 6) {
      badgeEl.textContent = labels.join(' - ');
    } else if (labels.length > 6) {
      badgeEl.textContent = labels.length + ' Jenjang Terdaftar';
    } else {
      badgeEl.textContent = 'Semua Jenjang';
    }
  }

  const dataValues = labels.map(function (k) { return jenjangCounts[k] || 0; });
  const maxVal = Math.max.apply(null, dataValues.concat([10]));

  // Palet Gradasi 3D per Jenjang [Warna Terang Atas, Warna Badan, Warna Gelap Bawah]
  const JENJANG_3D_PALETTE = {
    'SD': ['#f87171', '#ef4444', '#b91c1c'],
    'MI': ['#38bdf8', '#0ea5e9', '#0369a1'],
    'SMP': ['#60a5fa', '#3b82f6', '#1d4ed8'],
    'MTS': ['#22d3ee', '#06b6d4', '#0e7490'],
    'SMA': ['#818cf8', '#6366f1', '#4338ca'],
    'MA': ['#34d399', '#10b981', '#047857'],
    'SMK': ['#fbbf24', '#f59e0b', '#b45309'],
    'SLB': ['#a3e635', '#84cc16', '#4d7c0f'],
    'PKBM': ['#fb923c', '#f97316', '#c2410c'],
    'SKB': ['#94a3b8', '#64748b', '#334155'],
    'PAUD': ['#f472b6', '#ec4899', '#be185d'],
    'TK': ['#fb7185', '#f43f5e', '#be123c'],
    'KB': ['#e879f9', '#d946ef', '#a21caf'],
    'TPA': ['#c084fc', '#a855f7', '#7e22ce'],
    'SPS': ['#a78bfa', '#8b5cf6', '#6d28d9'],
    'RA': ['#2dd4bf', '#14b8a6', '#0f766e']
  };

  const FALLBACK_3D_PALETTE = [
    ['#38bdf8', '#0ea5e9', '#0369a1'],
    ['#f472b6', '#ec4899', '#be185d'],
    ['#2dd4bf', '#14b8a6', '#0f766e'],
    ['#c084fc', '#a855f7', '#7e22ce'],
    ['#fb923c', '#f97316', '#c2410c'],
    ['#a3e635', '#84cc16', '#4d7c0f'],
    ['#94a3b8', '#64748b', '#334155']
  ];

  // Buat Canvas Linear Gradient untuk setiap batang
  const bgColors = labels.map(function (k, idx) {
    const pal = JENJANG_3D_PALETTE[k] || FALLBACK_3D_PALETTE[idx % FALLBACK_3D_PALETTE.length];
    const g = ctx.createLinearGradient(0, 40, 0, 240);
    g.addColorStop(0, pal[0]);   // Glossy highlight atas
    g.addColorStop(0.5, pal[1]); // Badan batang
    g.addColorStop(1, pal[2]);   // Bayangan dasar pekat
    return g;
  });

  if (APP_STATE.chartBarInstance) {
    APP_STATE.chartBarInstance.destroy();
  }

  // Plugin 1: 3D Column Shadow (Bayangan Ambient di Bawah Tiap Batang)
  const bar3DShadowPlugin = {
    id: 'bar3DShadowPlugin',
    beforeDatasetDraw: function (chart, args) {
      if (args.index !== 0) return;
      const chartCtx = chart.ctx;
      chartCtx.save();
      chartCtx.shadowColor = 'rgba(15, 23, 42, 0.14)';
      chartCtx.shadowBlur = 8;
      chartCtx.shadowOffsetX = 0;
      chartCtx.shadowOffsetY = 4;
    },
    afterDatasetDraw: function (chart, args) {
      if (args.index !== 0) return;
      chart.ctx.restore();
    }
  };

  // Plugin 2: Floating Value Labels (Angka Mengambang di Atas Tiap Puncak Batang)
  const barValueLabelsPlugin = {
    id: 'barValueLabelsPlugin',
    afterDatasetsDraw: function (chart) {
      const chartCtx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;

      chartCtx.save();
      chartCtx.font = '700 11.5px Outfit, Inter, sans-serif';
      chartCtx.fillStyle = '#0f172a';
      chartCtx.textAlign = 'center';
      chartCtx.textBaseline = 'bottom';

      meta.data.forEach(function (bar, idx) {
        const val = chart.data.datasets[0].data[idx];
        if (val > 0) {
          chartCtx.fillText(val, bar.x, bar.y - 4);
        }
      });
      chartCtx.restore();
    }
  };

  APP_STATE.chartBarInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Jumlah Satuan Pendidikan',
        data: dataValues,
        backgroundColor: bgColors,
        borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 2, bottomRight: 2 },
        borderSkipped: false,
        maxBarThickness: 38
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 850,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: { top: 18, bottom: 4, left: 6, right: 6 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Outfit', size: 13, weight: 700 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function (ctx) { return ' ' + ctx.raw + ' Satuan Pendidikan'; }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: Math.ceil(maxVal * 1.18),
          ticks: {
            stepSize: 1,
            precision: 0,
            font: { family: 'Inter', size: 11 },
            color: '#64748b'
          },
          grid: { color: '#f1f5f9' },
          border: { dash: [4, 4], color: '#e2e8f0' }
        },
        x: {
          ticks: {
            font: { family: 'Inter', size: 11, weight: 700 },
            color: '#334155'
          },
          grid: { display: false }
        }
      }
    },
    plugins: [bar3DShadowPlugin, barValueLabelsPlugin]
  });
}

/**
 * Render Tabel pada Tab Dashboard (Berdasarkan filter asesor yang aktif)
 * Paginasi 100 baris per halaman dengan urutan nomor baris berlanjut
 */
function renderDashboardTable(items) {
  if (items !== undefined) {
    APP_STATE.currentDashboardItems = items || [];
  }
  const allItems = APP_STATE.currentDashboardItems || [];
  const totalItems = allItems.length;
  const pageSize = APP_STATE.dashboardPageSize || 100;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (APP_STATE.dashboardPage > totalPages) {
    APP_STATE.dashboardPage = totalPages;
  }
  if (APP_STATE.dashboardPage < 1) {
    APP_STATE.dashboardPage = 1;
  }

  const currentPage = APP_STATE.dashboardPage;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageItems = allItems.slice(startIdx, endIdx);

  const tbody = document.getElementById('dashboardTableBody');
  tbody.innerHTML = '';

  if (!allItems || allItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 2rem; color: #94a3b8;">Tidak ada data sekolah untuk asesor terpilih.</td></tr>';
    updatePaginationUI('dashboard', 0, 0, 0, 1, 1);
    return;
  }

  pageItems.forEach(function (item, idx) {
    const rowNo = startIdx + idx + 1;
    const tr = document.createElement('tr');

    tr.innerHTML =
      '<td style="text-align:center; font-weight:600; color:#64748b;">' + rowNo + '</td>' +
      '<td style="font-family:monospace; font-weight:600; color:#0f172a;">' + item.npsn + '</td>' +
      '<td class="school-cell">' +
      '<div class="school-name">' + item.namaSekolah + '</div>' +
      '<div class="school-meta"><span>' + item.kabSekolah + '</span></div>' +
      '</td>' +
      '<td><span class="badge-jenjang ' + item.jenjang + '">' + item.jenjang + '</span></td>' +
      '<td><span class="badge-tahap">' + (item.tahap || 'Tahap 1') + '</span></td>' +
      '<td>' + item.kabSekolah + '</td>' +
      '<td>' +
      '<div class="asesor-pill-name">' + item.namaAsesor1 + '</div>' +
      '<div class="asesor-pill-sub">NIA: ' + item.nia1 + ' (' + item.kabAsesor1 + ')</div>' +
      '</td>' +
      '<td>' +
      '<div class="asesor-pill-name">' + item.namaAsesor2 + '</div>' +
      '<div class="asesor-pill-sub">NIA: ' + item.nia2 + ' (' + item.kabAsesor2 + ')</div>' +
      '</td>' +
      '<td>' + createStatusBadge(item, 'status1', item.status1) + '</td>' +
      '<td>' + createStatusBadge(item, 'status2', item.status2) + '</td>' +
      '<td>' + createStatusBadge(item, 'statusKelompok', item.statusKelompok) + '</td>';

    tbody.appendChild(tr);
  });

  updatePaginationUI('dashboard', startIdx + 1, endIdx, totalItems, currentPage, totalPages);
}

/**
 * Berpindah halaman pada tabel Tab Dashboard
 */
function changeDashboardPage(p) {
  const newPage = parseInt(p, 10);
  if (isNaN(newPage) || newPage < 1) return;
  APP_STATE.dashboardPage = newPage;
  renderDashboardTable();
  const tbl = document.getElementById('tableDashboardHeading');
  if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onSelectPageDashboardChange(val) {
  changeDashboardPage(val);
}

/**
 * Render Tabel Lengkap pada Tab Data Penilaian
 * Paginasi 100 baris per halaman dengan urutan nomor baris berlanjut
 */
function renderFullTable() {
  const tbody = document.getElementById('fullTableBody');
  const searchKeyword = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const statusFilter = APP_STATE.currentFilterFull;
  const filterTahap = document.getElementById('filterDataTahap') ? document.getElementById('filterDataTahap').value : 'ALL';

  let filtered = APP_STATE.items.filter(function (item) {
    // Text Search
    const matchSearch = !searchKeyword ||
      item.npsn.toLowerCase().includes(searchKeyword) ||
      item.namaSekolah.toLowerCase().includes(searchKeyword) ||
      item.namaAsesor1.toLowerCase().includes(searchKeyword) ||
      item.namaAsesor2.toLowerCase().includes(searchKeyword) ||
      item.kabSekolah.toLowerCase().includes(searchKeyword);

    if (!matchSearch) return false;

    // Filter Tahap
    if (filterTahap !== 'ALL' && item.tahap !== filterTahap) {
      return false;
    }

    // Quick Filter Status
    const isSelesai = (item.status1 === 'SELESAI' && item.status2 === 'SELESAI' && item.statusKelompok === 'SELESAI');
    if (statusFilter === 'BELUM') {
      return !isSelesai;
    } else if (statusFilter === 'SELESAI') {
      return isSelesai;
    }
    return true;
  });

  APP_STATE.currentFullItems = filtered;
  const totalItems = filtered.length;
  const pageSize = APP_STATE.fullTablePageSize || 100;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (APP_STATE.fullTablePage > totalPages) {
    APP_STATE.fullTablePage = totalPages;
  }
  if (APP_STATE.fullTablePage < 1) {
    APP_STATE.fullTablePage = 1;
  }

  const currentPage = APP_STATE.fullTablePage;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageItems = filtered.slice(startIdx, endIdx);

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 2.5rem; color: #94a3b8;">Data tidak ditemukan sesuai kata kunci pencarian.</td></tr>';
    updatePaginationUI('full', 0, 0, 0, 1, 1);
    return;
  }

  pageItems.forEach(function (item, idx) {
    const rowNo = startIdx + idx + 1;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="text-align:center; font-weight:600; color:#64748b;">' + rowNo + '</td>' +
      '<td style="font-family:monospace; font-weight:600; color:#0f172a;">' + item.npsn + '</td>' +
      '<td class="school-cell">' +
      '<div class="school-name">' + item.namaSekolah + '</div>' +
      '</td>' +
      '<td><span class="badge-jenjang ' + item.jenjang + '">' + item.jenjang + '</span></td>' +
      '<td><span class="badge-tahap">' + (item.tahap || 'Tahap 1') + '</span></td>' +
      '<td>' + item.kabSekolah + '</td>' +
      '<td>' +
      '<div class="asesor-pill-name">' + item.namaAsesor1 + '</div>' +
      '<div class="asesor-pill-sub">NIA: ' + item.nia1 + '</div>' +
      '</td>' +
      '<td>' + item.kabAsesor1 + '</td>' +
      '<td>' +
      '<div class="asesor-pill-name">' + item.namaAsesor2 + '</div>' +
      '<div class="asesor-pill-sub">NIA: ' + item.nia2 + '</div>' +
      '</td>' +
      '<td>' + item.kabAsesor2 + '</td>' +
      '<td>' + createStatusBadge(item, 'status1', item.status1) + '</td>' +
      '<td>' + createStatusBadge(item, 'status2', item.status2) + '</td>' +
      '<td>' + createStatusBadge(item, 'statusKelompok', item.statusKelompok) + '</td>';

    tbody.appendChild(tr);
  });

  updatePaginationUI('full', startIdx + 1, endIdx, totalItems, currentPage, totalPages);
}

/**
 * Berpindah halaman pada tabel Tab Data Penilaian Lengkap
 */
function changeFullPage(p) {
  const newPage = parseInt(p, 10);
  if (isNaN(newPage) || newPage < 1) return;
  APP_STATE.fullTablePage = newPage;
  renderFullTable();
  const el = document.getElementById('searchInput');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onSelectPageFullChange(val) {
  changeFullPage(val);
}

function filterFullTable() {
  APP_STATE.fullTablePage = 1;
  renderFullTable();
}

function setQuickFilter(type, btnEl, e) {
  if (e && e.preventDefault) e.preventDefault();
  APP_STATE.fullTablePage = 1;
  APP_STATE.currentFilterFull = type;
  const allBtns = document.querySelectorAll('.toolbar-actions .filter-btn');
  allBtns.forEach(function (b) { b.classList.remove('active'); });
  if (!btnEl && type) {
    btnEl = document.querySelector('.filter-btn[href="#status-' + type.toLowerCase() + '"]');
  }
  if (btnEl) btnEl.classList.add('active');
  renderFullTable();
}

/**
 * Memperbarui Bilah Paginasi dan Dropdown Urutan Angka (Tab 1 & Tab 2)
 */
function updatePaginationUI(type, startNum, endNum, totalItems, currentPage, totalPages) {
  const isDashboard = (type === 'dashboard');
  const infoEl = document.getElementById(isDashboard ? 'paginationInfoDashboard' : 'paginationInfoFull');
  const controlsEl = document.getElementById(isDashboard ? 'paginationControlsDashboard' : 'paginationControlsFull');
  const selectEl = document.getElementById(isDashboard ? 'selectPageDashboard' : 'selectPageFull');
  const changeFn = isDashboard ? changeDashboardPage : changeFullPage;

  // 1. Perbarui Info Teks
  if (infoEl) {
    if (totalItems === 0) {
      infoEl.innerHTML = 'Menampilkan <strong>0</strong> dari <strong>0</strong> sekolah';
    } else {
      infoEl.innerHTML = 'Menampilkan <strong>' + startNum + ' - ' + endNum + '</strong> dari <strong>' + totalItems + '</strong> sekolah';
    }
  }

  // 2. Perbarui Dropdown Selektor Urutan Angka / Halaman
  if (selectEl) {
    selectEl.innerHTML = '';
    if (totalItems === 0 || totalPages <= 1) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = totalItems === 0 ? 'Halaman 1 (0 sekolah)' : 'Halaman 1 (Baris 1 - ' + totalItems + ')';
      selectEl.appendChild(opt);
      selectEl.disabled = (totalItems === 0);
    } else {
      selectEl.disabled = false;
      for (let p = 1; p <= totalPages; p++) {
        const pStart = (p - 1) * 100 + 1;
        const pEnd = Math.min(p * 100, totalItems);
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = 'Halaman ' + p + ' (Baris ' + pStart + ' - ' + pEnd + ')';
        if (p === currentPage) opt.selected = true;
        selectEl.appendChild(opt);
      }
    }
  }

  // 3. Perbarui Tombol Navigasi Angka
  if (controlsEl) {
    controlsEl.innerHTML = '';
    if (totalItems === 0) return;

    // Tombol Sebelumnya
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '&lsaquo; Sebelumnya';
    prevBtn.title = 'Halaman Sebelumnya';
    if (currentPage <= 1) {
      prevBtn.disabled = true;
    } else {
      prevBtn.onclick = function () { changeFn(currentPage - 1); };
    }
    controlsEl.appendChild(prevBtn);

    // Fungsi pembantu tombol angka
    function createPageBtn(pNum) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pagination-btn' + (pNum === currentPage ? ' active' : '');
      btn.textContent = pNum;
      btn.title = 'Buka Halaman ' + pNum;
      if (pNum === currentPage) {
        btn.disabled = true;
      } else {
        btn.onclick = function () { changeFn(pNum); };
      }
      controlsEl.appendChild(btn);
    }

    function createEllipsis() {
      const span = document.createElement('span');
      span.className = 'pagination-ellipsis';
      span.textContent = '...';
      controlsEl.appendChild(span);
    }

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        createPageBtn(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          createPageBtn(i);
        }
        createEllipsis();
        createPageBtn(totalPages);
      } else if (currentPage >= totalPages - 3) {
        createPageBtn(1);
        createEllipsis();
        for (let i = totalPages - 4; i <= totalPages; i++) {
          createPageBtn(i);
        }
      } else {
        createPageBtn(1);
        createEllipsis();
        createPageBtn(currentPage - 1);
        createPageBtn(currentPage);
        createPageBtn(currentPage + 1);
        createEllipsis();
        createPageBtn(totalPages);
      }
    }

    // Tombol Selanjutnya
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = 'Selanjutnya &rsaquo;';
    nextBtn.title = 'Halaman Selanjutnya';
    if (currentPage >= totalPages) {
      nextBtn.disabled = true;
    } else {
      nextBtn.onclick = function () { changeFn(currentPage + 1); };
    }
    controlsEl.appendChild(nextBtn);
  }
}

// Sambungkan fungsi paginasi ke objek window global
window.changeDashboardPage = changeDashboardPage;
window.changeFullPage = changeFullPage;
window.onSelectPageDashboardChange = onSelectPageDashboardChange;
window.onSelectPageFullChange = onSelectPageFullChange;

/**
 * Membuat tombol badge status interaktif
 */
function createStatusBadge(item, field, currentVal) {
  const isSelesai = currentVal === 'SELESAI';
  const badgeClass = isSelesai ? 'selesai' : 'belum';
  const label = isSelesai ? 'SELESAI' : 'BELUM';

  // Jika role adalah User (Viewer), nonaktifkan aksi klik (Read-Only)
  if (APP_STATE.currentUserRole === 'user') {
    return '<span class="status-badge ' + badgeClass + '" style="cursor: default;" title="Mode Tinjauan (User)">' +
      '<span class="status-dot"></span>' + label + '</span>';
  }

  return '<span class="status-badge ' + badgeClass + '" onclick="openStatusModal(' + item.no + ', \'' + field + '\', \'' + currentVal + '\')" title="Klik untuk ubah status">' +
    '<span class="status-dot"></span>' + label + '</span>';
}

/**
 * Modal Konfirmasi Perubahan Status
 */
function openStatusModal(noId, field, currentVal) {
  const item = APP_STATE.items.find(function (s) { return s.no === noId; });
  if (!item) return;

  const fieldNames = {
    status1: 'Nilai Asesor 1 (' + item.namaAsesor1 + ')',
    status2: 'Nilai Asesor 2 (' + item.namaAsesor2 + ')',
    statusKelompok: 'Nilai Kelompok Penilai'
  };

  const newStatus = currentVal === 'SELESAI' ? 'BELUM' : 'SELESAI';

  APP_STATE.pendingModalData = {
    item: item,
    field: field,
    currentStatus: currentVal,
    newStatus: newStatus
  };

  document.getElementById('modalSchoolName').textContent = item.namaSekolah;
  document.getElementById('modalSchoolMeta').textContent = 'NPSN: ' + item.npsn + ' | ' + item.jenjang + ' - ' + item.kabSekolah;
  document.getElementById('modalFieldLabel').textContent = fieldNames[field] || field;
  document.getElementById('modalCurrentStatus').innerHTML =
    '<span style="color:' + (currentVal === 'SELESAI' ? '#059669' : '#e11d48') + '; font-weight:700;">' + currentVal + '</span> &rarr; Ubah ke <span style="color:' + (newStatus === 'SELESAI' ? '#059669' : '#e11d48') + '; font-weight:700;">' + newStatus + '</span>';

  document.getElementById('statusModal').classList.add('active');
}

function closeStatusModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  document.getElementById('statusModal').classList.remove('active');
  APP_STATE.pendingModalData = null;
}

/**
 * Menyimpan perubahan status ke Backend / Local Storage
 */
function confirmStatusToggle() {
  if (!APP_STATE.pendingModalData) return;
  const p = APP_STATE.pendingModalData;
  const btn = document.getElementById('btnConfirmToggle');
  btn.textContent = 'Menyimpan...';
  btn.disabled = true;

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        btn.textContent = 'Simpan Pembaruan';
        btn.disabled = false;
        closeStatusModal();
        if (res && res.success) {
          p.item[p.field] = p.newStatus;
          showToast('Status berhasil diubah menjadi ' + p.newStatus);
          refreshData(false);
        } else {
          showToast(res.message || 'Gagal mengubah status', true);
        }
      })
      .withFailureHandler(function (err) {
        btn.textContent = 'Simpan Pembaruan';
        btn.disabled = false;
        closeStatusModal();
        showToast('Kesalahan server: ' + err.toString(), true);
      })
      .updateStatusPenilaian(p.item.rowNumber, p.field, p.newStatus);
  } else {
    // Mode Standalone Browser
    setTimeout(function () {
      btn.textContent = 'Simpan Pembaruan';
      btn.disabled = false;
      closeStatusModal();
      p.item[p.field] = p.newStatus;
      localStorage.setItem('SIM_ASESOR_DATA', JSON.stringify(APP_STATE.items));
      showToast('Status berhasil diubah menjadi ' + p.newStatus);
      const computed = computeStatsAndAsesorList(APP_STATE.items);
      applyLoadedData(APP_STATE.items, computed.daftarAsesor, computed.stats);
    }, 300);
  }
}

/* ==========================================================================
   MODUL IMPORT DATA EXCEL (KHUSUS ADMINISTRATOR)
   ========================================================================== */
function openImportModal() {
  const modal = document.getElementById('modalImportExcel');
  if (modal) modal.classList.add('active');
  resetExcelImport();
}

function closeImportModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalImportExcel');
  if (modal) modal.classList.remove('active');
  resetExcelImport();
}

function setImportMode(mode) {
  APP_STATE.importMode = mode;
  const cardReplace = document.getElementById('labelModeReplace');
  const cardAppend = document.getElementById('labelModeAppend');
  const radioReplace = document.getElementById('radioModeReplace');
  const radioAppend = document.getElementById('radioModeAppend');

  if (mode === 'replace') {
    if (cardReplace) cardReplace.classList.add('active');
    if (cardAppend) cardAppend.classList.remove('active');
    if (radioReplace) radioReplace.checked = true;
  } else {
    if (cardAppend) cardAppend.classList.add('active');
    if (cardReplace) cardReplace.classList.remove('active');
    if (radioAppend) radioAppend.checked = true;
  }
}

function downloadExcelTemplate() {
  const headers = [
    'No',
    'NPSN',
    'Nama Sekolah',
    'Jenjang',
    'Kab/Kota',
    'NIA ASESOR 1',
    'NAMA ASESOR 1',
    'KABUPATEN KOTA 1',
    'NIA ASESOR 2',
    'NAMA ASESOR 2',
    'KABUPATEN KOTA 2',
    'Nilai Asesor 1',
    'Nilai Asesor 2',
    'Nilai Kelompok',
    'Tahap'
  ];

  const sample1 = [
    1, '70003201', 'UPTD SD NEGERI BUKRUR', 'SD', 'KABUPATEN ALOR',
    '12345', 'RUDI', 'ALOR', '43218', 'ANTON', 'SABU RAIJUA',
    'V', 'V', 'V', 'Tahap 1'
  ];
  const sample2 = [
    2, '50305812', 'SD GMIT PROBUR I', 'SD', 'KABUPATEN ALOR',
    '66778', 'YON', 'SLEMAN', '55541', 'SATRIA', 'SABU RAIJUA',
    'V', '-', 'V', 'Tahap 1'
  ];

  try {
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DataPenilaian');
      XLSX.writeFile(wb, 'Template_DataPenilaian_SIM-ASESOR.xlsx');
      showToast('Template Excel berhasil diunduh.');
      return;
    }
  } catch (err) {
    console.warn('SheetJS error, menggunakan fallback CSV:', err);
  }

  // Fallback CSV jika offline
  const csvRows = [headers, sample1, sample2].map(function (row) {
    return row.map(function (v) {
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(',');
  });
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Template_DataPenilaian_SIM-ASESOR.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Template CSV berhasil diunduh.');
}

function resetExcelImport() {
  APP_STATE.importedRows = null;
  APP_STATE.importMode = 'replace';
  setImportMode('replace');

  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.value = '';

  const previewSection = document.getElementById('importFilePreviewSection');
  if (previewSection) previewSection.style.display = 'none';

  const progressBox = document.getElementById('importProgressBox');
  if (progressBox) progressBox.style.display = 'none';

  const dropzone = document.getElementById('excelDropzone');
  if (dropzone) dropzone.style.display = 'block';

  const btn = document.getElementById('btnExecuteImport');
  const btnText = document.getElementById('btnExecuteImportText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Mulai Import Data';
}

function handleExcelFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (file) processExcelFile(file);
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('excelDropzone');
  if (dropzone) dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('excelDropzone');
  if (dropzone) dropzone.classList.remove('dragover');
}

function handleDropFile(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('excelDropzone');
  if (dropzone) dropzone.classList.remove('dragover');

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    processExcelFile(e.dataTransfer.files[0]);
  }
}

function processExcelFile(file) {
  if (!file) return;

  const validExts = ['.xlsx', '.xls', '.csv'];
  const fileNameLower = file.name.toLowerCase();
  const isValidExt = validExts.some(function (ext) { return fileNameLower.endsWith(ext); });

  if (!isValidExt) {
    showToast('Format berkas tidak valid. Harap gunakan berkas .xlsx, .xls, atau .csv');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Pustaka SheetJS belum dimuat. Periksa koneksi internet Anda.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        showToast('Berkas Excel tidak memiliki sheet yang valid.');
        return;
      }

      // Cari sheet 'DataPenilaian' atau gunakan sheet pertama
      let targetSheetName = workbook.SheetNames[0];
      for (let s = 0; s < workbook.SheetNames.length; s++) {
        if (workbook.SheetNames[s].toLowerCase().includes('datapenilaian') || workbook.SheetNames[s].toLowerCase().includes('penilaian')) {
          targetSheetName = workbook.SheetNames[s];
          break;
        }
      }

      const worksheet = workbook.Sheets[targetSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

      if (!rawRows || rawRows.length < 2) {
        showToast('Berkas kosong atau hanya memiliki header tanpa data.');
        return;
      }

      // Validasi & Ekstraksi baris (lewati baris 0 sebagai header)
      const validRows = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const npsn = String(row[1] || '').trim();
        const namaSekolah = String(row[2] || '').trim();

        // Lewati baris kosong
        if (!npsn && !namaSekolah) continue;

        validRows.push(row);
      }

      if (validRows.length === 0) {
        showToast('Tidak ditemukan baris data satuan pendidikan yang valid.');
        return;
      }

      APP_STATE.importedRows = validRows;
      APP_STATE.importedFileName = file.name;
      APP_STATE.importedFileSize = (file.size / 1024).toFixed(1) + ' KB';

      renderImportPreview();
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses berkas Excel: ' + (err.message || err.toString()));
    }
  };

  reader.onerror = function () {
    showToast('Terjadi kesalahan saat membaca berkas.');
  };

  reader.readAsArrayBuffer(file);
}

function renderImportPreview() {
  const rows = APP_STATE.importedRows || [];
  const previewSection = document.getElementById('importFilePreviewSection');
  const dropzone = document.getElementById('excelDropzone');
  const fileNameEl = document.getElementById('previewFileName');
  const fileSizeEl = document.getElementById('previewFileSize');
  const totalRowsEl = document.getElementById('previewTotalRows');
  const tbody = document.getElementById('importPreviewTableBody');
  const btn = document.getElementById('btnExecuteImport');

  if (fileNameEl) fileNameEl.textContent = APP_STATE.importedFileName || '-';
  if (fileSizeEl) fileSizeEl.textContent = '(' + (APP_STATE.importedFileSize || '') + ')';
  if (totalRowsEl) totalRowsEl.textContent = rows.length + ' Satuan Pendidikan';

  if (tbody) {
    let html = '';
    const previewLimit = Math.min(rows.length, 5);
    for (let i = 0; i < previewLimit; i++) {
      const r = rows[i];
      const npsn = r[1] || '-';
      const nama = r[2] || '-';
      const jenjang = r[3] || '-';
      const kab = r[4] || '-';
      const as1 = r[6] || r[5] || '-';
      const as2 = r[9] || r[8] || '-';
      const tahap = r[14] || 'Tahap 1';

      html += '<tr style="border-bottom: 1px solid #f1f5f9;">' +
        '<td style="padding: 6px 8px; font-weight: 600; color: #1e3a8a;">' + npsn + '</td>' +
        '<td style="padding: 6px 8px; color: #0f172a; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + nama + '</td>' +
        '<td style="padding: 6px 8px; color: #475569;">' + jenjang + '</td>' +
        '<td style="padding: 6px 8px; color: #475569;">' + kab + '</td>' +
        '<td style="padding: 6px 8px; color: #334155;">' + as1 + '</td>' +
        '<td style="padding: 6px 8px; color: #334155;">' + as2 + '</td>' +
        '<td style="padding: 6px 8px; color: #64748b;">' + tahap + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;
  }

  if (previewSection) previewSection.style.display = 'block';
  if (dropzone) dropzone.style.display = 'none';
  if (btn) btn.disabled = false;
}

function submitImportExcel() {
  if (!APP_STATE.importedRows || APP_STATE.importedRows.length === 0) {
    showToast('Silakan pilih berkas Excel terlebih dahulu.');
    return;
  }

  const mode = APP_STATE.importMode || 'replace';
  const modeDesc = mode === 'replace' ? 'Perbarui Total (Timpa)' : 'Tambahkan Data Baru';

  const confirmMsg = 'Apakah Anda yakin ingin memproses Import Data Excel sebanyak ' +
    APP_STATE.importedRows.length + ' data sekolah dengan metode ' + modeDesc + '?';
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('btnExecuteImport');
  const btnText = document.getElementById('btnExecuteImportText');
  const progressBox = document.getElementById('importProgressBox');
  const progressText = document.getElementById('importProgressText');

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Memproses...';
  if (progressBox) progressBox.style.display = 'block';
  if (progressText) progressText.textContent = 'Sedang mengunggah dan memproses ' + APP_STATE.importedRows.length + ' data ke sheet DataPenilaian...';

  const savedUserStr = sessionStorage.getItem('SIM_ASESOR_USER');
  let savedUser = null;
  if (savedUserStr) {
    try { savedUser = JSON.parse(savedUserStr); } catch (e) { }
  }

  const activeUser = APP_STATE.currentUser || savedUser || {};
  const activeRole = activeUser.role || APP_STATE.currentUserRole || sessionStorage.getItem('SIM_ASESOR_ROLE') || 'Admin';

  const currentUser = {
    username: activeUser.username || 'admin',
    nama: activeUser.nama || 'Administrator Sistem',
    role: activeRole
  };

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (progressBox) progressBox.style.display = 'none';
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Mulai Import Data';

        if (res && res.success) {
          showToast(res.message);
          closeImportModal();
          refreshData(true);
        } else {
          showToast((res && res.message) || 'Gagal memproses import data Excel.', true);
        }
      })
      .withFailureHandler(function (err) {
        if (progressBox) progressBox.style.display = 'none';
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Mulai Import Data';
        showToast('Kesalahan server: ' + (err.message || err.toString()), true);
      })
      .importDataPenilaian(APP_STATE.importedRows, mode, currentUser);
  } else {
    // Mode Standalone Browser (Simulasi Offline)
    setTimeout(function () {
      if (progressBox) progressBox.style.display = 'none';
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Mulai Import Data';

      const newItems = APP_STATE.importedRows.map(function (r, idx) {
        return {
          no: mode === 'replace' ? (idx + 1) : (APP_STATE.items.length + idx + 1),
          npsn: String(r[1] || '').trim(),
          namaSekolah: String(r[2] || '').trim(),
          jenjang: String(r[3] || 'SD').trim().toUpperCase(),
          kabSekolah: String(r[4] || '').trim(),
          nia1: String(r[5] || '').trim(),
          namaAsesor1: String(r[6] || '').trim(),
          kabAsesor1: String(r[7] || '').trim(),
          nia2: String(r[8] || '').trim(),
          namaAsesor2: String(r[9] || '').trim(),
          kabAsesor2: String(r[10] || '').trim(),
          status1: (function (v) { var s = String(v || '').trim().toUpperCase(); return (s === 'V' || s === '✓' || s === '✔' || s === '1' || s === 'TRUE' || s.indexOf('SELESAI') !== -1) ? 'SELESAI' : 'BELUM'; })(r[11]),
          status2: (function (v) { var s = String(v || '').trim().toUpperCase(); return (s === 'V' || s === '✓' || s === '✔' || s === '1' || s === 'TRUE' || s.indexOf('SELESAI') !== -1) ? 'SELESAI' : 'BELUM'; })(r[12]),
          statusKelompok: (function (v) { var s = String(v || '').trim().toUpperCase(); return (s === 'V' || s === '✓' || s === '✔' || s === '1' || s === 'TRUE' || s.indexOf('SELESAI') !== -1) ? 'SELESAI' : 'BELUM'; })(r[13]),
          tahap: String(r[14] || 'Tahap 1').trim(),
          rowNumber: mode === 'replace' ? (idx + 2) : (APP_STATE.items.length + idx + 2)
        };
      });

      if (mode === 'replace') {
        APP_STATE.items = newItems;
      } else {
        APP_STATE.items = APP_STATE.items.concat(newItems);
      }

      localStorage.setItem('SIM_ASESOR_DATA', JSON.stringify(APP_STATE.items));
      const computed = computeStatsAndAsesorList(APP_STATE.items);
      applyLoadedData(APP_STATE.items, computed.daftarAsesor, computed.stats);

      showToast('Simulasi Berhasil: Diimpor ' + newItems.length + ' data (' + modeDesc + ')');
      closeImportModal();
    }, 800);
  }
}

/* ==========================================================================
   MODUL LOG AKTIVITAS PENGGUNA (SHEET DATAUSER)
   ========================================================================== */
function openLogModal() {
  const modal = document.getElementById('modalLogAktivitas');
  if (modal) modal.classList.add('active');
  fetchLogAktivitas(false);
}

function closeLogModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalLogAktivitas');
  if (modal) modal.classList.remove('active');
}

function fetchLogAktivitas(isManual) {
  const tbody = document.getElementById('tbodyLogAktivitas');
  const countEl = document.getElementById('logTotalCount');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">' +
      '<div class="loader-spinner" style="margin: 0 auto 0.5rem auto; width: 24px; height: 24px; border-width: 2.5px;"></div>' +
      'Memuat riwayat aktivitas dari sheet DataUser...' +
      '</td></tr>';
  }

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          renderLogTable(res.logs);
          if (countEl) countEl.textContent = (res.logs ? res.logs.length : 0) + ' Aktivitas';
          if (isManual) showToast('Data log aktivitas berhasil diperbarui.');
        } else {
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #ef4444;">' +
              'Gagal memuat log: ' + ((res && res.message) || 'Unknown error') +
              '</td></tr>';
          }
        }
      })
      .withFailureHandler(function (err) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #ef4444;">' +
            'Kesalahan server saat memuat log: ' + (err.message || err.toString()) +
            '</td></tr>';
        }
      })
      .ambilLogAktivitas();
  } else {
    // Mode Standalone Browser (Simulasi Offline)
    setTimeout(function () {
      const mockLogs = [
        { no: 1, waktu: '18 Okt 2026, 11:20:15 WITA', username: 'admin', nama: 'Administrator Sistem', aktivitas: 'Login Sistem', keterangan: 'Autentikasi akun admin berhasil' },
        { no: 2, waktu: '18 Okt 2026, 11:25:40 WITA', username: 'admin', nama: 'Administrator Sistem', aktivitas: 'Import Data Excel', keterangan: 'Berhasil mengimpor 6 data sekolah (Timpa Seluruh Data)' },
        { no: 3, waktu: '18 Okt 2026, 11:30:10 WITA', username: 'admin', nama: 'Administrator Sistem', aktivitas: 'Update Status Nilai', keterangan: 'Ubah Nilai Asesor 1 pada baris #2 menjadi SELESAI' }
      ];
      renderLogTable(mockLogs);
      if (countEl) countEl.textContent = mockLogs.length + ' Aktivitas (Simulasi)';
      if (isManual) showToast('Log aktivitas diperbarui.');
    }, 350);
  }
}

function renderLogTable(logs) {
  const tbody = document.getElementById('tbodyLogAktivitas');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">Belum ada riwayat aktivitas yang tercatat di sheet DataUser.</td></tr>';
    return;
  }

  let html = '';
  logs.forEach(function (l, idx) {
    let badgeClass = 'log-badge-login';
    const akt = String(l.aktivitas || '').toLowerCase();
    if (akt.includes('import')) {
      badgeClass = 'log-badge-import';
    } else if (akt.includes('update') || akt.includes('status')) {
      badgeClass = 'log-badge-update';
    } else if (akt.includes('tambah') || akt.includes('penugasan')) {
      badgeClass = 'log-badge-tambah';
    }

    html += '<tr style="border-bottom: 1px solid #f1f5f9;">' +
      '<td style="padding: 8px 10px; text-align: center; color: #64748b; font-weight: 600;">' + (l.no || (idx + 1)) + '</td>' +
      '<td style="padding: 8px 10px; white-space: nowrap; font-size: 0.75rem; color: #475569;">' + (l.waktu || '-') + '</td>' +
      '<td style="padding: 8px 10px; white-space: nowrap;">' +
      '<div style="font-weight: 600; color: #0f172a;">' + (l.nama || l.username || '-') + '</div>' +
      '<div style="font-size: 0.7rem; color: #64748b;">@' + (l.username || '-') + '</div>' +
      '</td>' +
      '<td style="padding: 8px 10px; white-space: nowrap;">' +
      '<span class="log-badge-activity ' + badgeClass + '">' + (l.aktivitas || '-') + '</span>' +
      '</td>' +
      '<td style="padding: 8px 10px; color: #334155; line-height: 1.35;">' + (l.keterangan || '-') + '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}

/* ==========================================================================
   MODUL MANAJEMEN PENGGUNA (SHEET DATAUSER) - KHUSUS ADMINISTRATOR
   ========================================================================== */
const USER_MANAGEMENT_STATE = {
  users: []
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtmlAttr(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatDeviceBadge(perangkatStr, isCurrent) {
  let dev = String(perangkatStr || '').trim();
  if ((!dev || dev === '-' || dev === 'undefined' || dev === 'null') && isCurrent) {
    dev = getClientDeviceInfo();
  }
  if (!dev || dev === '-' || dev === 'undefined' || dev === 'null') {
    return '<span style="color: #94a3b8; font-size: 0.725rem;">-</span>';
  }

  const devLower = dev.toLowerCase();
  const isTablet = devLower.includes('tablet') || devLower.includes('ipad');
  const isMobile = devLower.includes('hp') || devLower.includes('android') || devLower.includes('iphone') || devLower.includes('mobile');

  if (isTablet) {
    return '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 0.685rem; font-weight: 600; background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe;" title="' + escapeHtmlAttr(dev) + '">' +
      '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>' +
      '<span>' + escapeHtmlAttr(dev) + '</span>' +
      '</span>';
  }

  if (isMobile) {
    return '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 0.685rem; font-weight: 600; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;" title="' + escapeHtmlAttr(dev) + '">' +
      '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>' +
      '<span>' + escapeHtmlAttr(dev) + '</span>' +
      '</span>';
  }

  // Laptop / PC (Default)
  return '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 0.685rem; font-weight: 600; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1;" title="' + escapeHtmlAttr(dev) + '">' +
    '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>' +
    '<span>' + escapeHtmlAttr(dev) + '</span>' +
    '</span>';
}

function openUserModal() {
  const curRole = String(APP_STATE.currentUserRole || '').toLowerCase();
  const curUsername = (APP_STATE.currentUser && APP_STATE.currentUser.username) ? String(APP_STATE.currentUser.username).toLowerCase() : '';
  const isAdmin = (curRole === 'admin' || curUsername === 'admin');

  if (!isAdmin) {
    showToast('Akses ditolak: Menu ini hanya diperuntukkan bagi Administrator Sistem.');
    return;
  }

  const modal = document.getElementById('modalUserManagement');
  if (modal) modal.classList.add('active');
  toggleAddUserForm(false);
  const searchInp = document.getElementById('userSearchInput');
  if (searchInp) searchInp.value = '';
  fetchUserList(false);
}

function closeUserModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalUserManagement');
  if (modal) modal.classList.remove('active');
}

function toggleAddUserForm(forceState) {
  const formBox = document.getElementById('formAddUserContainer');
  const btnText = document.getElementById('btnToggleAddUserText');
  if (!formBox) return;

  let shouldShow;
  if (typeof forceState === 'boolean') {
    shouldShow = forceState;
  } else {
    shouldShow = formBox.style.display === 'none';
  }

  formBox.style.display = shouldShow ? 'block' : 'none';
  if (btnText) btnText.textContent = shouldShow ? 'Tutup Formulir' : 'Tambah Pengguna';

  if (shouldShow) {
    const formEl = document.getElementById('formAddUser');
    if (formEl) formEl.reset();
    const uInp = document.getElementById('addUsername');
    if (uInp) uInp.focus();
  }
}

function fetchUserList(isManual) {
  const tbody = document.getElementById('tbodyUserManagement');
  const countEl = document.getElementById('userTotalCount');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">' +
      '<div class="loader-spinner" style="margin: 0 auto 0.5rem auto; width: 24px; height: 24px; border-width: 2.5px;"></div>' +
      'Memuat data akun pengguna dari sheet DataUser...' +
      '</td></tr>';
  }

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          USER_MANAGEMENT_STATE.users = res.users || [];
          renderUserTable(USER_MANAGEMENT_STATE.users);
          if (countEl) countEl.textContent = USER_MANAGEMENT_STATE.users.length + ' Akun';
          if (isManual) showToast('Data pengguna berhasil diperbarui.');
        } else {
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 1.5rem; color: #ef4444;">' +
              'Gagal memuat pengguna: ' + ((res && res.message) || 'Unknown error') +
              '</td></tr>';
          }
        }
      })
      .withFailureHandler(function (err) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 1.5rem; color: #ef4444;">' +
            'Kesalahan server saat memuat pengguna: ' + (err.message || err.toString()) +
            '</td></tr>';
        }
      })
      .ambilSemuaPengguna(APP_STATE.currentUser);
  } else {
    // Mode Standalone Browser (Simulasi Offline)
    setTimeout(function () {
      let localUsers = [];
      const stored = localStorage.getItem('SIM_USER_LIST');
      if (stored) {
        try { localUsers = JSON.parse(stored); } catch (e) { localUsers = []; }
      }
      if (!localUsers || localUsers.length === 0) {
        localUsers = [
          { no: 1, rowNumber: 2, username: 'admin', nama: 'Administrator Sistem', role: 'Admin', status: 'Aktif', terakhirLogin: '20 Okt 2026, 06:44:22 WITA', aktivitasTerakhir: 'Login Sistem', perangkat: 'Laptop (Windows)' },
          { no: 108, rowNumber: 3, username: 'user', nama: 'USER', role: 'User', status: 'Aktif', terakhirLogin: '20 Okt 2026, 06:42:08 WITA', aktivitasTerakhir: 'Lihat Dashboard', perangkat: 'HP (Android)' }
        ];
        localStorage.setItem('SIM_USER_LIST', JSON.stringify(localUsers));
      }
      USER_MANAGEMENT_STATE.users = localUsers;
      renderUserTable(localUsers);
      if (countEl) countEl.textContent = localUsers.length + ' Akun (Simulasi)';
      if (isManual) showToast('Data pengguna diperbarui.');
    }, 300);
  }
}

function renderUserTable(users) {
  const tbody = document.getElementById('tbodyUserManagement');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">Tidak ada data pengguna yang sesuai.</td></tr>';
    return;
  }

  const curUsername = (APP_STATE.currentUser && APP_STATE.currentUser.username) ? String(APP_STATE.currentUser.username).toLowerCase() : '';

  let html = '';
  users.forEach(function (u, idx) {
    const uName = String(u.username || '').trim();
    const uNameLower = uName.toLowerCase();
    const isCurrent = (uNameLower === curUsername);
    const isPrimaryAdmin = (uNameLower === 'admin');

    const roleClass = (String(u.role).toLowerCase() === 'admin')
      ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;'
      : 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;';

    const statusClass = (String(u.status).toLowerCase() === 'aktif')
      ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
      : 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;';

    const deleteDisabled = isCurrent || isPrimaryAdmin;
    let deleteTooltip = 'Hapus Pengguna';
    if (isPrimaryAdmin) deleteTooltip = 'Akun utama "admin" tidak dapat dihapus demi keamanan';
    else if (isCurrent) deleteTooltip = 'Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini';

    html += '<tr style="border-bottom: 1px solid #f1f5f9;">' +
      '<td style="padding: 8px 10px; text-align: center; color: #64748b; font-weight: 600;">' + (u.no || (idx + 1)) + '</td>' +
      '<td style="padding: 8px 10px; white-space: nowrap;">' +
      '<div style="font-weight: 700; color: #0f172a;">@' + uName + '</div>' +
      (isCurrent ? '<span style="font-size: 0.65rem; color: #2563eb; font-weight: 600;">(Akun Anda)</span>' : '') +
      '</td>' +
      '<td style="padding: 8px 10px; font-weight: 500; color: #334155; white-space: nowrap;">' + (u.nama || '-') + '</td>' +
      '<td style="padding: 8px 10px; text-align: center; white-space: nowrap;">' +
      '<span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; ' + roleClass + '">' + (u.role || 'User') + '</span>' +
      '</td>' +
      '<td style="padding: 8px 10px; text-align: center; white-space: nowrap;">' +
      '<span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; ' + statusClass + '">' + (u.status || 'Aktif') + '</span>' +
      '</td>' +
      '<td style="padding: 8px 10px; white-space: nowrap; font-size: 0.725rem; color: #64748b;">' + (u.terakhirLogin || '-') + '</td>' +
      '<td style="padding: 8px 10px; text-align: center; white-space: nowrap;">' + formatDeviceBadge(u.perangkat, isCurrent) + '</td>' +
      '<td style="padding: 8px 10px; text-align: center; white-space: nowrap;">' +
      '<div style="display: inline-flex; align-items: center; gap: 4px;">' +
      '<a href="#change-password" class="btn-secondary" onclick="openChangePasswordModal(\'' + escapeHtmlAttr(uName) + '\', \'' + escapeHtmlAttr(u.nama || uName) + '\'); if(event) event.preventDefault();" role="button" title="Ubah / Buat Kata Sandi" style="font-size: 0.7rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 3px; border-radius: 4px; text-decoration: none; color: inherit; cursor: pointer;">' +
      '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Password</span>' +
      '</a>' +
      (deleteDisabled ?
        '<span class="btn-secondary" title="' + deleteTooltip + '" style="opacity: 0.45; cursor: not-allowed; font-size: 0.7rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 3px; border-radius: 4px; color: #94a3b8; border-color: #e2e8f0;">' +
        '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '<span>Hapus</span>' +
        '</span>' :
        '<a href="#delete-user" class="btn-secondary" onclick="confirmDeleteUser(\'' + escapeHtmlAttr(uName) + '\', \'' + escapeHtmlAttr(u.nama || uName) + '\'); if(event) event.preventDefault();" role="button" title="' + deleteTooltip + '" style="font-size: 0.7rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 3px; border-radius: 4px; color: #dc2626; border-color: #fecaca; background: #fef2f2; text-decoration: none; cursor: pointer;">' +
        '<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '<span>Hapus</span>' +
        '</a>'
      ) +
      '</div>' +
      '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}

function filterUserTable() {
  const q = (document.getElementById('userSearchInput') ? document.getElementById('userSearchInput').value : '').toLowerCase().trim();
  if (!q) {
    renderUserTable(USER_MANAGEMENT_STATE.users);
    return;
  }
  const filtered = USER_MANAGEMENT_STATE.users.filter(function (u) {
    const uName = String(u.username || '').toLowerCase();
    const nama = String(u.nama || '').toLowerCase();
    return uName.includes(q) || nama.includes(q);
  });
  renderUserTable(filtered);
}

function submitAddUser() {
  const uInp = document.getElementById('addUsername');
  const pInp = document.getElementById('addPassword');
  const nInp = document.getElementById('addNamaLengkap');
  const rInp = document.getElementById('addRole');
  const sInp = document.getElementById('addStatus');
  const btnSubmit = document.getElementById('btnSubmitAddUser');

  const username = (uInp ? uInp.value : '').trim().toLowerCase();
  const password = (pInp ? pInp.value : '').trim();
  const nama = (nInp ? nInp.value : '').trim();
  const role = rInp ? rInp.value : 'User';
  const status = sInp ? sInp.value : 'Aktif';

  if (!username || !password || !nama) {
    showToast('Username, kata sandi, dan nama lengkap wajib diisi.');
    return;
  }

  if (!/^[a-z0-9_.]+$/.test(username)) {
    showToast('Username hanya boleh terdiri dari huruf kecil, angka, titik, atau garis bawah.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Menyimpan...</span>';
  }

  const userData = {
    username: username,
    password: password,
    nama: nama,
    role: role,
    status: status
  };

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Simpan Pengguna</span>';
        }
        if (res && res.success) {
          showToast(res.message || 'Pengguna berhasil ditambahkan.');
          toggleAddUserForm(false);
          fetchUserList(false);
        } else {
          showToast('Gagal: ' + ((res && res.message) || 'Terjadi kesalahan sistem.'));
        }
      })
      .withFailureHandler(function (err) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Simpan Pengguna</span>';
        }
        showToast('Kesalahan server: ' + (err.message || err.toString()));
      })
      .tambahPengguna(userData, APP_STATE.currentUser);
  } else {
    // Simulasi Standalone Browser
    setTimeout(function () {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Simpan Pengguna</span>';
      }
      let localUsers = [];
      const stored = localStorage.getItem('SIM_USER_LIST');
      if (stored) {
        try { localUsers = JSON.parse(stored); } catch (e) { localUsers = []; }
      }
      const exists = localUsers.some(function (item) {
        return String(item.username).toLowerCase() === username;
      });
      if (exists) {
        showToast('Username "' + username + '" sudah digunakan.');
        return;
      }

      const newNo = localUsers.length + 1;
      localUsers.push({
        no: newNo,
        rowNumber: newNo + 1,
        username: username,
        nama: nama,
        role: role,
        status: status,
        terakhirLogin: '-',
        aktivitasTerakhir: '-'
      });
      localStorage.setItem('SIM_USER_LIST', JSON.stringify(localUsers));

      showToast('Simulasi Berhasil: Pengguna "' + username + '" ditambahkan.');
      toggleAddUserForm(false);
      fetchUserList(false);
    }, 350);
  }
}

function openChangePasswordModal(username, nama) {
  const targetUserInp = document.getElementById('changePassTargetUsername');
  const dispUser = document.getElementById('changePassDisplayUsername');
  const dispName = document.getElementById('changePassDisplayName');
  const newPassInp = document.getElementById('newPasswordInput');

  if (targetUserInp) targetUserInp.value = username;
  if (dispUser) dispUser.textContent = '@' + username;
  if (dispName) dispName.textContent = nama || username;
  if (newPassInp) {
    newPassInp.value = '';
    setTimeout(function () { newPassInp.focus(); }, 100);
  }

  const modal = document.getElementById('modalChangePassword');
  if (modal) modal.classList.add('active');
}

function closeChangePasswordModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalChangePassword');
  if (modal) modal.classList.remove('active');
}

function submitChangePassword() {
  const targetUserInp = document.getElementById('changePassTargetUsername');
  const newPassInp = document.getElementById('newPasswordInput');
  const btnSubmit = document.getElementById('btnSubmitChangePassword');

  const targetUsername = (targetUserInp ? targetUserInp.value : '').trim();
  const newPass = (newPassInp ? newPassInp.value : '').trim();

  if (!targetUsername || !newPass) {
    showToast('Kata sandi baru tidak boleh kosong.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Menyimpan...</span>';
  }

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Simpan Kata Sandi</span>';
        }
        if (res && res.success) {
          showToast(res.message || 'Kata sandi berhasil diperbarui.');
          closeChangePasswordModal();
        } else {
          showToast('Gagal: ' + ((res && res.message) || 'Terjadi kesalahan sistem.'));
        }
      })
      .withFailureHandler(function (err) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Simpan Kata Sandi</span>';
        }
        showToast('Kesalahan server: ' + (err.message || err.toString()));
      })
      .ubahPasswordPengguna(targetUsername, newPass, APP_STATE.currentUser);
  } else {
    // Simulasi Standalone Browser
    setTimeout(function () {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Simpan Kata Sandi</span>';
      }
      showToast('Simulasi Berhasil: Kata sandi untuk @"' + targetUsername + '" telah diperbarui.');
      closeChangePasswordModal();
    }, 350);
  }
}

function confirmDeleteUser(username, nama) {
  const curUsername = (APP_STATE.currentUser && APP_STATE.currentUser.username) ? String(APP_STATE.currentUser.username).toLowerCase() : '';
  const targetLower = String(username || '').toLowerCase();

  if (targetLower === 'admin') {
    showToast('Akun utama "admin" tidak dapat dihapus demi keamanan sistem.');
    return;
  }

  if (targetLower === curUsername) {
    showToast('Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
    return;
  }

  const confirmed = window.confirm('Apakah Anda yakin ingin menghapus akun pengguna "' + (nama || username) + '" (@' + username + ')?\n\nTindakan ini akan menghapus akun dari tab DataUser secara permanen.');
  if (!confirmed) return;

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          showToast(res.message || 'Pengguna berhasil dihapus.');
          fetchUserList(false);
        } else {
          showToast('Gagal: ' + ((res && res.message) || 'Terjadi kesalahan saat menghapus pengguna.'));
        }
      })
      .withFailureHandler(function (err) {
        showToast('Kesalahan server: ' + (err.message || err.toString()));
      })
      .hapusPengguna(username, APP_STATE.currentUser);
  } else {
    // Simulasi Standalone Browser
    setTimeout(function () {
      let localUsers = [];
      const stored = localStorage.getItem('SIM_USER_LIST');
      if (stored) {
        try { localUsers = JSON.parse(stored); } catch (e) { localUsers = []; }
      }
      localUsers = localUsers.filter(function (item) {
        return String(item.username).toLowerCase() !== targetLower;
      });
      localUsers.forEach(function (item, idx) {
        item.no = idx + 1;
        item.rowNumber = idx + 2;
      });
      localStorage.setItem('SIM_USER_LIST', JSON.stringify(localUsers));

      showToast('Simulasi Berhasil: Pengguna @' + username + ' berhasil dihapus.');
      fetchUserList(false);
    }, 350);
  }
}

/* ==========================================================================
   DATABASE ASESOR & PROFIL ASESOR CONTROLLER (SHEET DBASESOR - v1.0.65)
   ========================================================================== */
const DB_ASESOR_STATE = {
  asesors: [],
  filtered: []
};

function openDbAsesorModal() {
  const curRole = String(APP_STATE.currentUserRole || '').toLowerCase();
  const curUsername = (APP_STATE.currentUser && APP_STATE.currentUser.username) ? String(APP_STATE.currentUser.username).toLowerCase() : '';
  const isAdmin = (curRole === 'admin' || curUsername === 'admin');

  if (!isAdmin) {
    showToast('Akses ditolak: Menu Data Base Asesor hanya diperuntukkan bagi Administrator Sistem.');
    return;
  }

  const modal = document.getElementById('modalDbAsesor');
  if (modal) modal.classList.add('active');

  const sInp = document.getElementById('dbAsesorSearchInput');
  if (sInp) sInp.value = '';
  const filterKab = document.getElementById('dbAsesorFilterKab');
  if (filterKab) filterKab.value = '';
  const filterJenjang = document.getElementById('dbAsesorFilterJenjang');
  if (filterJenjang) filterJenjang.value = '';

  fetchDbAsesorList(false);
}

function closeDbAsesorModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalDbAsesor');
  if (modal) modal.classList.remove('active');
}

function fetchDbAsesorList(isManual) {
  const tbody = document.getElementById('tbodyDbAsesor');
  const countEl = document.getElementById('dbAsesorTotalCount');

  // 1. Prioritas Utama: In-Memory Cache DBAsesor
  if (!isManual && Array.isArray(DB_ASESOR_STATE.asesors) && DB_ASESOR_STATE.asesors.length > 0) {
    populateDbAsesorFilters(DB_ASESOR_STATE.asesors);
    filterDbAsesorTable();
    return;
  }

  // 2. Pre-population Instan dari Local Storage Khusus DBAsesor (Bukan dari DataPenilaian 241)
  let hasLocalDbCache = false;
  if (!isManual && (!DB_ASESOR_STATE.asesors || DB_ASESOR_STATE.asesors.length === 0)) {
    try {
      const rawDbCache = localStorage.getItem('SIM_ASESOR_DB_ASESOR_CACHE');
      if (rawDbCache) {
        const cachedList = JSON.parse(rawDbCache);
        if (Array.isArray(cachedList) && cachedList.length > 0) {
          DB_ASESOR_STATE.asesors = cachedList;
          populateDbAsesorFilters(cachedList);
          filterDbAsesorTable();
          hasLocalDbCache = true;
        }
      }
    } catch (e) { }
  }

  // Tampilkan spinner jika belum ada data di memori maupun cache lokal
  if (!hasLocalDbCache && tbody) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2.5rem; color: #64748b;">' +
      '<div class="loader-spinner" style="margin: 0 auto 0.75rem auto;"></div>' +
      '<div>Memuat data profil asesor dari sheet DBAsesor...</div>' +
      '</td></tr>';
  }

  // Timeout Guard 45 Detik: Realistis untuk putaran Google Cloud RPC
  const timeoutId = setTimeout(function () {
    if (!DB_ASESOR_STATE.asesors || DB_ASESOR_STATE.asesors.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: #ef4444;">' +
          'Pemuatan data dari sheet DBAsesor melebihi batas waktu (koneksi lambat).' +
          '<div style="margin-top: 0.5rem;"><button type="button" class="btn-secondary" onclick="fetchDbAsesorList(true)" style="padding: 4px 10px; font-size: 0.75rem;">Coba Lagi</button></div>' +
          '</td></tr>';
      }
    }
  }, 45000);

  const onFetchSuccess = function (asesorsList) {
    clearTimeout(timeoutId);
    if (Array.isArray(asesorsList) && asesorsList.length > 0) {
      DB_ASESOR_STATE.asesors = asesorsList;
      try {
        localStorage.setItem('SIM_ASESOR_DB_ASESOR_CACHE', JSON.stringify(asesorsList));
      } catch (e) { }
      populateDbAsesorFilters(asesorsList);
      filterDbAsesorTable();
      if (isManual) showToast('Data DBAsesor (' + asesorsList.length + ' Asesor) berhasil dimuat.');
    } else if (Array.isArray(asesorsList) && asesorsList.length === 0) {
      DB_ASESOR_STATE.asesors = [];
      populateDbAsesorFilters([]);
      filterDbAsesorTable();
    }
  };

  const onFetchError = function (errMsg) {
    clearTimeout(timeoutId);
    if (hasLocalDbCache || (DB_ASESOR_STATE.asesors && DB_ASESOR_STATE.asesors.length > 0)) {
      console.warn('Gagal sync DBAsesor:', errMsg);
      if (isManual) showToast('Gagal menyegarkan: ' + errMsg, true);
    } else if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #ef4444;">' +
        '<div style="font-weight: 700; margin-bottom: 0.35rem;">Gagal Memuat Sheet DBAsesor</div>' +
        '<div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">' + escapeHtml(errMsg) + '</div>' +
        '<button type="button" class="btn-secondary" onclick="fetchDbAsesorList(true)" style="padding: 6px 14px; font-size: 0.8rem;">Coba Lagi</button>' +
        '</td></tr>';
    }
  };

  if (APP_STATE.isGoogleAppsScript) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          onFetchSuccess(res.asesors || []);
        } else {
          onFetchError((res && res.message) || 'Sheet DBAsesor tidak dapat diakses.');
        }
      })
      .withFailureHandler(function (err) {
        onFetchError(err.message || err.toString());
      })
      .ambilSemuaDbAsesor();
  } else {
    // Mode Standalone Browser / Vercel API
    const loadFromApiOrLocal = function () {
      if (APP_STATE.apiBaseUrl) {
        fetch(APP_STATE.apiBaseUrl + '?action=ambilSemuaDbAsesor')
          .then(function (res) { return res.json(); })
          .then(function (res) {
            if (res && res.success && Array.isArray(res.asesors)) {
              onFetchSuccess(res.asesors);
              return;
            }
            fallbackStandalone();
          })
          .catch(function (err) {
            fallbackStandalone();
          });
      } else {
        fallbackStandalone();
      }
    };

    const fallbackStandalone = function () {
      const list = [
        { no: 1, rowNumber: 2, nia: '5371025001', nama: 'Dr. Arifin, M.Pd', kabupaten: 'KOTA KUPANG', instansi: 'BAN PDM Prov. NTT', jenjang: 'PAUD/Dikdas/Dikmen', peran: 'Ketua BAN PDM', status: 'Sertifikat Aktif', sediaBertugas: 'Bersedia', noHp: '081234567890' },
        { no: 2, rowNumber: 3, nia: '5371025002', nama: 'Adhy Lawa, S.Pd', kabupaten: 'KABUPATEN KUPANG', instansi: 'Dinas P&K NTT', jenjang: 'Dikdas', peran: 'Asesor 1', status: 'Sertifikat Aktif', sediaBertugas: 'Bersedia', noHp: '082144556677' },
        { no: 3, rowNumber: 4, nia: '5371025003', nama: 'Maria Goreti, M.Pd', kabupaten: 'KABUPATEN SIKKA', instansi: 'Dinas P&K Sikka', jenjang: 'Dikdas', peran: 'Asesor 2', status: 'Sertifikat Aktif', sediaBertugas: 'Bersedia', noHp: '081339123456' },
        { no: 4, rowNumber: 5, nia: '5371025004', nama: 'Petrus Kanisius, S.Ag', kabupaten: 'KABUPATEN MANGGARAI', instansi: 'Kemenag NTT', jenjang: 'Dikmen', peran: 'Asesor 1', status: 'Sertifikat Aktif', sediaBertugas: 'Bersedia', noHp: '085239987654' }
      ];
      onFetchSuccess(list);
    };

    setTimeout(loadFromApiOrLocal, 150);
  }
}

function populateDbAsesorFilters(asesorList) {
  const kabSelect = document.getElementById('dbAsesorFilterKab');
  const jenjangSelect = document.getElementById('dbAsesorFilterJenjang');
  if (!kabSelect) return;

  const curKab = kabSelect.value;
  const kabSet = {};

  asesorList.forEach(function (item) {
    if (item.kabupaten && item.kabupaten !== '-') kabSet[item.kabupaten] = true;
  });

  kabSelect.innerHTML = '<option value="">Semua Kabupaten / Kota</option>' +
    Object.keys(kabSet).sort().map(function (k) {
      return '<option value="' + k + '"' + (curKab === k ? ' selected' : '') + '>' + k + '</option>';
    }).join('');

  if (jenjangSelect) {
    const curJenjang = jenjangSelect.value;
    const jenjangSet = {};
    asesorList.forEach(function (item) {
      if (item.jenjang && item.jenjang !== '-') jenjangSet[item.jenjang] = true;
    });
    jenjangSelect.innerHTML = '<option value="">Semua Jenjang</option>' +
      Object.keys(jenjangSet).sort().map(function (j) {
        return '<option value="' + j + '"' + (curJenjang === j ? ' selected' : '') + '>' + j + '</option>';
      }).join('');
  }
}

function clearDbAsesorSearch() {
  const sInp = document.getElementById('dbAsesorSearchInput');
  if (sInp) {
    sInp.value = '';
    sInp.focus();
  }
  filterDbAsesorTable();
}

function filterDbAsesorTable() {
  const sInp = document.getElementById('dbAsesorSearchInput');
  const kabSelect = document.getElementById('dbAsesorFilterKab');
  const countEl = document.getElementById('dbAsesorTotalCount');

  const q = sInp ? sInp.value.trim().toLowerCase() : '';
  const filterKab = kabSelect ? kabSelect.value.trim().toLowerCase() : '';

  // Tampilkan atau sembunyikan tombol pembersih cepat "✕"
  const clearBtn = document.getElementById('btnDbAsesorClearSearch');
  if (clearBtn) {
    clearBtn.style.display = q ? 'inline-flex' : 'none';
  }

  const filtered = (DB_ASESOR_STATE.asesors || []).filter(function (item) {
    if (filterKab && String(item.kabupaten || '').trim().toLowerCase() !== filterKab) {
      return false;
    }
    if (q) {
      const matchNama = String(item.nama || '').toLowerCase().includes(q);
      const matchNia = String(item.nia || '').toLowerCase().includes(q);
      const matchKab = String(item.kabupaten || '').toLowerCase().includes(q);
      const matchInstansi = String(item.instansi || '').toLowerCase().includes(q);
      const matchHp = String(item.noHp || '').toLowerCase().includes(q);
      if (!matchNama && !matchNia && !matchKab && !matchInstansi && !matchHp) {
        return false;
      }
    }
    return true;
  });

  DB_ASESOR_STATE.filtered = filtered;
  if (countEl) countEl.textContent = filtered.length;
  renderDbAsesorTable(filtered);
}

function renderDbAsesorTable(list) {
  const tbody = document.getElementById('tbodyDbAsesor');
  if (!tbody) return;

  try {
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2.5rem; color: #64748b;">' +
        'Tidak ada data asesor yang sesuai dengan filter atau kata kunci pencarian.' +
        '</td></tr>';
      return;
    }

    let html = '';
    for (let i = 0; i < list.length; i++) {
      const item = list[i] || {};
      const safeNia = escapeHtml(item.nia || '-');
      const safeNama = escapeHtml(item.nama || '-');
      const safeKab = escapeHtml(item.kabupaten || '-');
      const rowNum = item.rowNumber || (i + 2);

      html += '<tr style="border-bottom: 1px solid #e2e8f0;">' +
        '<td class="asesor-nia-cell">' + safeNia + '</td>' +
        '<td class="asesor-nama-cell">' + safeNama + '</td>' +
        '<td>' + safeKab + '</td>' +
        '<td style="text-align: center;">' +
        '<button type="button" class="btn-table-edit" onclick="openEditAsesorModal(\'' + escapeHtmlAttr(safeNia) + '\', ' + rowNum + ')" title="Edit data ' + escapeHtmlAttr(safeNama) + '">Edit</button>' +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error renderDbAsesorTable:', err);
    let fallbackHtml = '';
    for (let i = 0; i < (list || []).length; i++) {
      const it = list[i] || {};
      fallbackHtml += '<tr style="border-bottom: 1px solid #e2e8f0;">' +
        '<td class="asesor-nia-cell">' + (it.nia || '-') + '</td>' +
        '<td class="asesor-nama-cell">' + (it.nama || '-') + '</td>' +
        '<td>' + (it.kabupaten || '-') + '</td>' +
        '<td style="text-align: center;">' +
        '<button type="button" class="btn-table-edit" onclick="openEditAsesorModal(\'' + (it.nia || '-') + '\', ' + (it.rowNumber || (i + 2)) + ')">Edit</button>' +
        '</td>' +
        '</tr>';
    }
    tbody.innerHTML = fallbackHtml;
  }
}

function openEditAsesorModal(niaKey, rowNum) {
  const all = DB_ASESOR_STATE.asesors || [];
  let found = null;
  if (rowNum && rowNum > 0) {
    found = all.find(function (a) { return a.rowNumber === rowNum; });
  }
  if (!found && niaKey && niaKey !== '-') {
    found = all.find(function (a) { return String(a.nia || '').trim() === String(niaKey).trim(); });
  }

  if (!found) {
    showToast('Data asesor tidak ditemukan untuk diedit.');
    return;
  }

  const modal = document.getElementById('modalEditAsesor');
  if (!modal) return;

  const setVal = function (id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('editAsesorRowNumber', found.rowNumber || '');
  setVal('editAsesorNia', found.nia && found.nia !== '-' ? found.nia : '');
  setVal('editAsesorNama', found.nama && found.nama !== '-' ? found.nama : '');
  setVal('editAsesorStatus', found.status || 'Sertifikat Aktif');
  setVal('editAsesorKab', found.kabupaten && found.kabupaten !== '-' ? found.kabupaten : '');
  setVal('editAsesorSedia', found.sediaBertugas || 'Bersedia');
  setVal('editAsesorHp', found.noHp && found.noHp !== '-' ? found.noHp : '');
  setVal('editAsesorInstansi', found.instansi && found.instansi !== '-' ? found.instansi : '');
  setVal('editAsesorJenjang', found.jenjang && found.jenjang !== '-' ? found.jenjang : '');
  setVal('editAsesorPeran', found.peran && found.peran !== '-' ? found.peran : '');

  modal.classList.add('active');
}

function closeEditAsesorModal() {
  const modal = document.getElementById('modalEditAsesor');
  if (modal) modal.classList.remove('active');
}

function submitEditAsesor(e) {
  if (e && e.preventDefault) e.preventDefault();

  const rowNumber = parseInt(document.getElementById('editAsesorRowNumber').value, 10);
  const nia = document.getElementById('editAsesorNia').value.trim();
  const nama = document.getElementById('editAsesorNama').value.trim();
  const status = document.getElementById('editAsesorStatus').value.trim();
  const kabupaten = document.getElementById('editAsesorKab').value.trim();
  const sediaBertugas = document.getElementById('editAsesorSedia').value.trim();
  const noHp = document.getElementById('editAsesorHp').value.trim();
  const instansi = document.getElementById('editAsesorInstansi').value.trim();
  const jenjang = document.getElementById('editAsesorJenjang').value.trim();
  const peran = document.getElementById('editAsesorPeran').value.trim();

  if (!nia || !nama || !kabupaten) {
    showToast('Mohon lengkapi NIA, Nama, dan Kabupaten.');
    return;
  }

  const payload = {
    rowNumber: rowNumber,
    nia: nia,
    nama: nama,
    status: status,
    kabupaten: kabupaten,
    sediaBertugas: sediaBertugas,
    noHp: noHp,
    instansi: instansi,
    jenjang: jenjang,
    peran: peran
  };

  const btnSave = document.getElementById('btnSaveEditAsesor');
  const lblSave = document.getElementById('labelSaveEditAsesor');
  if (btnSave) btnSave.disabled = true;
  if (lblSave) lblSave.textContent = 'Menyimpan...';

  // Mode REST API / Vercel
  fetch(APP_STATE.apiBaseUrl ? (APP_STATE.apiBaseUrl + '?action=updateDbAsesor') : '?action=updateDbAsesor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateDbAsesor', asesorData: payload, currentUser: APP_STATE.currentUser })
  })
    .then(function (res) { return res.json(); })
    .then(function (res) {
      if (btnSave) btnSave.disabled = false;
      if (lblSave) lblSave.textContent = 'Simpan';
      if (res && res.success) {
        showToast(res.message || 'Data Asesor berhasil diperbarui.');
        closeEditAsesorModal();
        fetchDbAsesorList(false);
      } else {
        const foundIdx = (DB_ASESOR_STATE.asesors || []).findIndex(function (a) { return a.rowNumber === rowNumber || a.nia === nia; });
        if (foundIdx >= 0) {
          Object.assign(DB_ASESOR_STATE.asesors[foundIdx], payload);
          filterDbAsesorTable();
          showToast('Data Asesor berhasil diperbarui (Simulasi Lokal).');
          closeEditAsesorModal();
        } else {
          showToast('Gagal menyimpan: ' + ((res && res.message) || 'Error'), true);
        }
      }
    })
    .catch(function (err) {
      if (btnSave) btnSave.disabled = false;
      if (lblSave) lblSave.textContent = 'Simpan';
      const foundIdx = (DB_ASESOR_STATE.asesors || []).findIndex(function (a) { return a.rowNumber === rowNumber || a.nia === nia; });
      if (foundIdx >= 0) {
        Object.assign(DB_ASESOR_STATE.asesors[foundIdx], payload);
        filterDbAsesorTable();
        showToast('Data Asesor berhasil diperbarui.');
        closeEditAsesorModal();
      } else {
        showToast('Gagal terhubung ke backend: ' + err.message, true);
      }
    });
}

function openProfilAsesorModal(niaKey, namaKey) {
  const all = DB_ASESOR_STATE.asesors || [];
  let found = null;

  if (niaKey && niaKey !== '-') {
    found = all.find(function (a) { return String(a.nia || '').trim().toLowerCase() === String(niaKey).trim().toLowerCase(); });
  }
  if (!found && namaKey) {
    found = all.find(function (a) { return String(a.nama || '').trim().toUpperCase() === String(namaKey).trim().toUpperCase(); });
  }

  if (!found) {
    showToast('Data profil asesor tidak ditemukan.');
    return;
  }

  // Hitung / perbarui statistik kinerja dari APP_STATE.items jika penugasanList kosong
  let stats = found.stats || { totalSekolah: 0, selesai: 0, belumSelesai: 0, progres: 0, penugasanList: [] };
  if ((!stats.penugasanList || stats.penugasanList.length === 0) && Array.isArray(APP_STATE.items) && APP_STATE.items.length > 0) {
    const pItems = APP_STATE.items.filter(function (row) {
      const match1 = (row.namaAsesor1 && row.namaAsesor1.toUpperCase() === found.nama.toUpperCase()) || (row.nia1 && row.nia1 === found.nia);
      const match2 = (row.namaAsesor2 && row.namaAsesor2.toUpperCase() === found.nama.toUpperCase()) || (row.nia2 && row.nia2 === found.nia);
      return match1 || match2;
    });

    let selCount = 0;
    const pList = pItems.map(function (row) {
      const isA1 = (row.namaAsesor1 && row.namaAsesor1.toUpperCase() === found.nama.toUpperCase()) || (row.nia1 && row.nia1 === found.nia);
      const isSel = isA1 ? (row.status1 === 'SELESAI') : (row.status2 === 'SELESAI');
      if (isSel) selCount++;
      return {
        npsn: row.npsn,
        sekolah: row.namaSekolah,
        jenjang: row.jenjang,
        kabupaten: row.kabSekolah,
        tahap: row.tahap || '-',
        peran: isA1 ? 'Asesor 1' : 'Asesor 2',
        statusIndividu: isA1 ? row.status1 : row.status2,
        statusKelompok: row.statusKelompok
      };
    });

    const totalP = pList.length;
    stats = {
      totalSekolah: totalP,
      selesai: selCount,
      belumSelesai: Math.max(0, totalP - selCount),
      progres: totalP > 0 ? Math.round((selCount / totalP) * 100) : 0,
      penugasanList: pList
    };
  }

  // Inisial avatar
  const nameParts = String(found.nama || 'Asesor').trim().split(/\s+/);
  let initials = 'AS';
  if (nameParts.length >= 2) {
    initials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
  } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
    initials = nameParts[0].substring(0, 2).toUpperCase();
  }

  const avatarBox = document.getElementById('profilAvatarText');
  if (avatarBox) avatarBox.textContent = initials;

  const namaEl = document.getElementById('profilNamaLengkap');
  if (namaEl) namaEl.textContent = found.nama || '-';

  const niaEl = document.getElementById('profilNiaText');
  if (niaEl) niaEl.textContent = found.nia || '-';

  const kabEl = document.getElementById('profilKabText');
  if (kabEl) kabEl.textContent = found.kabupaten || '-';

  const jenjangBadge = document.getElementById('profilJenjangBadge');
  if (jenjangBadge) jenjangBadge.textContent = 'Jenjang: ' + (found.jenjang || '-');

  const peranBadge = document.getElementById('profilPeranBadge');
  if (peranBadge) peranBadge.textContent = 'Peran: ' + (found.peran || 'Asesor');

  const statusBadge = document.getElementById('profilStatusBadge');
  if (statusBadge) {
    const isAktif = String(found.status || '').toLowerCase().includes('aktif');
    statusBadge.textContent = found.status || 'Aktif';
    statusBadge.className = 'status-badge ' + (isAktif ? 'status-badge-selesai' : 'status-badge-belum');
  }

  const valNia = document.getElementById('profilValNia');
  if (valNia) valNia.textContent = found.nia || '-';

  const valHp = document.getElementById('profilValHp');
  if (valHp) valHp.textContent = found.noHp || '-';

  const valKab = document.getElementById('profilValKabupaten');
  if (valKab) valKab.textContent = found.kabupaten || '-';

  const valInstansi = document.getElementById('profilValInstansi');
  if (valInstansi) valInstansi.textContent = found.instansi || '-';

  const valJenjang = document.getElementById('profilValJenjang');
  if (valJenjang) valJenjang.textContent = found.jenjang || '-';

  const valPeran = document.getElementById('profilValPeran');
  if (valPeran) valPeran.textContent = found.peran || 'Asesor';

  const valStatus = document.getElementById('profilValStatus');
  if (valStatus) valStatus.textContent = found.status || 'Aktif';

  // Tombol WhatsApp
  const waContainer = document.getElementById('profilWaBtnContainer');
  if (waContainer) {
    const rawHp = String(found.noHp || '').trim();
    const digits = rawHp.replace(/\D/g, '');
    if (digits.length >= 9) {
      let intl = digits;
      if (intl.startsWith('0')) intl = '62' + intl.substring(1);
      waContainer.innerHTML = '<a href="https://wa.me/' + intl + '" target="_blank" rel="noopener noreferrer" class="btn-wa-link" style="display: inline-flex; padding: 5px 12px; font-size: 0.78rem;">' +
        '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
        '<span>Hubungi via WhatsApp</span>' +
        '</a>';
    } else {
      waContainer.innerHTML = '';
    }
  }

  // Statistik Kinerja
  const statTotal = document.getElementById('profilStatTotalSekolah');
  if (statTotal) statTotal.textContent = stats.totalSekolah || 0;

  const statSelesai = document.getElementById('profilStatSelesai');
  if (statSelesai) statSelesai.textContent = stats.selesai || 0;

  const statProgres = document.getElementById('profilStatProgres');
  if (statProgres) statProgres.textContent = (stats.progres || 0) + '%';

  // Tabel Riwayat Penugasan
  const tbodyRiwayat = document.getElementById('tbodyProfilPenugasan');
  if (tbodyRiwayat) {
    if (!stats.penugasanList || stats.penugasanList.length === 0) {
      tbodyRiwayat.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.25rem; color: #64748b;">Belum ada penugasan visitasi tercatat di sheet DataPenilaian.</td></tr>';
    } else {
      tbodyRiwayat.innerHTML = stats.penugasanList.map(function (p) {
        const isIndSel = (p.statusIndividu === 'SELESAI');
        const isKelSel = (p.statusKelompok === 'SELESAI');
        return '<tr style="border-bottom: 1px solid #e2e8f0;">' +
          '<td style="padding: 6px 8px;"><div style="font-weight: 600; color: #0f172a;">' + escapeHtml(p.sekolah) + '</div><div style="font-size: 0.68rem; color: #64748b; font-family: monospace;">' + escapeHtml(p.npsn) + ' (Tahap ' + escapeHtml(p.tahap) + ')</div></td>' +
          '<td style="padding: 6px 8px; color: #334155;">' + escapeHtml(p.kabupaten) + '</td>' +
          '<td style="padding: 6px 8px; text-align: center;"><span class="status-badge status-badge-info" style="font-size: 0.65rem; padding: 2px 5px;">' + escapeHtml(p.jenjang) + '</span></td>' +
          '<td style="padding: 6px 8px; text-align: center;"><span class="status-badge status-badge-purple" style="font-size: 0.65rem; padding: 2px 5px;">' + escapeHtml(p.peran) + '</span></td>' +
          '<td style="padding: 6px 8px; text-align: center;"><span class="status-badge ' + (isIndSel ? 'status-badge-selesai' : 'status-badge-belum') + '" style="font-size: 0.65rem; padding: 2px 5px;">' + (isIndSel ? 'SELESAI' : 'BELUM') + '</span></td>' +
          '<td style="padding: 6px 8px; text-align: center;"><span class="status-badge ' + (isKelSel ? 'status-badge-selesai' : 'status-badge-belum') + '" style="font-size: 0.65rem; padding: 2px 5px;">' + (isKelSel ? 'SELESAI' : 'BELUM') + '</span></td>' +
          '</tr>';
      }).join('');
    }
  }

  const modalProfil = document.getElementById('modalProfilAsesor');
  if (modalProfil) modalProfil.classList.add('active');
}

function closeProfilAsesorModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modalProfilAsesor');
  if (modal) modal.classList.remove('active');
}

/**
 * RENDER CETAK LAPORAN RESMI (A4 Landscape)
 * Format 1: LENGKAP (15 Kolom Rincian per Satuan Pendidikan)
 * Format 2: RINGKAS (6 Kolom: No, Nama Asesor, Asal Kabupaten Asesor, Total Penilaian, Selesai, Belum)
 */
function renderPrintPreview() {
  const thead = document.getElementById('printTableHead');
  const tbody = document.getElementById('printTableBody');
  const tfoot = document.getElementById('printTableFoot');
  const formatDokumen = document.getElementById('printFormatDokumen') ? document.getElementById('printFormatDokumen').value : 'LENGKAP';
  const filterAsesor = document.getElementById('printFilterAsesor').value;
  const filterJenjang = document.getElementById('printFilterJenjang').value;
  const filterStatus = document.getElementById('printFilterStatus').value;
  const filterTahap = document.getElementById('printFilterTahap') ? document.getElementById('printFilterTahap').value : 'ALL';

  // Elemen Kop & Metadata
  const docSublembaga = document.getElementById('printDocSublembaga');
  const docAlamat = document.getElementById('printDocAlamat');
  const countMetaLabel = document.getElementById('printCountMetaLabel');
  const rateMetaLabel = document.getElementById('printRateMetaLabel');

  // Update Asesor & Tahap & Sync Time Meta
  let asesorLabel = 'Semua Asesor';
  if (filterAsesor !== 'ALL') {
    const a = APP_STATE.daftarAsesor.find(function (x) { return x.id === filterAsesor; });
    if (a) asesorLabel = a.nama + ' (NIA: ' + a.nia + ')';
  }
  document.getElementById('printAsesorMeta').textContent = asesorLabel;
  if (document.getElementById('printTahapMeta')) {
    document.getElementById('printTahapMeta').textContent = filterTahap === 'ALL' ? 'Semua Tahap' : filterTahap;
  }
  if (document.getElementById('printSyncTimeMeta')) {
    document.getElementById('printSyncTimeMeta').textContent = APP_STATE.lastSyncTimestamp || '-';
  }

  // Sinkronisasi Tanggal Cetak & Tanda Tangan Terkini (v1.0.73)
  const nowPrint = new Date();
  const printDateEl = document.getElementById('printDateMeta');
  if (printDateEl) {
    printDateEl.textContent = nowPrint.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const sigDateEl = document.getElementById('sigDateLabel');
  if (sigDateEl) {
    sigDateEl.textContent = 'Kupang, ' + nowPrint.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (formatDokumen === 'RINGKAS') {
    // ========================================================
    // FORMAT 2: REKAPITULASI PENILAIAN PER ASESOR (6 KOLOM)
    // ========================================================
    if (docSublembaga) docSublembaga.textContent = 'REKAPITULASI PENILAIAN VISITASI AKREDITASI ASESOR';
    if (docAlamat) docAlamat.textContent = 'Laporan Rekapitulasi Beban dan Kelengkapan Penilaian Asesor Wilayah Akreditasi Satuan Pendidikan Provinsi NTT';
    if (countMetaLabel) countMetaLabel.textContent = 'Total Asesor Terdata:';
    if (rateMetaLabel) rateMetaLabel.textContent = 'Tingkat Penyelesaian Global:';

    // Filter sekolah berdasarkan jenjang dan tahap terlebih dahulu
    let scopedSchools = APP_STATE.items.filter(function (item) {
      if (filterJenjang !== 'ALL' && item.jenjang !== filterJenjang) return false;
      if (filterTahap !== 'ALL' && item.tahap !== filterTahap) return false;
      return true;
    });

    // Filter list asesor
    let asesorList = APP_STATE.daftarAsesor;
    if (filterAsesor !== 'ALL') {
      asesorList = asesorList.filter(function (a) { return a.id === filterAsesor; });
    }

    // Agregasi penilaian per asesor berdasarkan scopedSchools
    let rekapAsesor = [];
    let grandTotalPenilaian = 0;
    let grandTotalSelesai = 0;
    let grandTotalBelum = 0;
    let grandTotalSekolah = 0;

    asesorList.forEach(function (a) {
      let totalBeban = 0;
      let selesai = 0;
      let belum = 0;
      let uniqueSchools = {};
      let totalSekolah = 0;

      scopedSchools.forEach(function (s) {
        const isAsesor1 = ((s.namaAsesor1 && s.namaAsesor1.trim().toUpperCase() === a.id) || (s.nia1 && s.nia1.trim().toUpperCase() === a.id));
        const isAsesor2 = ((s.namaAsesor2 && s.namaAsesor2.trim().toUpperCase() === a.id) || (s.nia2 && s.nia2.trim().toUpperCase() === a.id));

        if (isAsesor1) {
          totalBeban += 2;
          if (s.status1 === 'SELESAI') selesai++; else belum++;
          if (s.statusKelompok === 'SELESAI') selesai++; else belum++;
        }
        if (isAsesor2) {
          totalBeban += 1;
          if (s.status2 === 'SELESAI') selesai++; else belum++;
        }
        if (isAsesor1 || isAsesor2) {
          const sKey = String(s.npsn || s.namaSekolah || s.no).trim();
          if (sKey && !uniqueSchools[sKey]) {
            uniqueSchools[sKey] = true;
            totalSekolah++;
          }
        }
      });

      // Jika jenjang atau tahap difilter dan asesor tidak memiliki tugas, lewati
      if ((filterJenjang !== 'ALL' || filterTahap !== 'ALL') && totalBeban === 0) {
        return;
      }

      // Filter status kelengkapan
      if (filterStatus === 'BELUM') {
        if (belum === 0) return;
      } else if (filterStatus === 'SELESAI') {
        if (belum > 0 || totalBeban === 0) return;
      }

      grandTotalPenilaian += totalBeban;
      grandTotalSelesai += selesai;
      grandTotalBelum += belum;
      grandTotalSekolah += totalSekolah;

      rekapAsesor.push({
        id: a.id,
        nama: a.nama,
        nia: a.nia,
        hp: a.hp || '-',
        kabupaten: a.kabupaten || '-',
        totalSekolah: totalSekolah,
        totalPenilaian: totalBeban,
        selesai: selesai,
        belum: belum
      });
    });

    // Update metadata dokumen
    document.getElementById('printCountMeta').textContent = rekapAsesor.length + ' Asesor';
    const globalRate = grandTotalPenilaian > 0 ? Math.round((grandTotalSelesai / grandTotalPenilaian) * 100) : 0;
    document.getElementById('printRateMeta').textContent = globalRate + '% (' + grandTotalSelesai + '/' + grandTotalPenilaian + ' Penilaian)';

    // Pasang thead 7 kolom
    if (thead) {
      thead.innerHTML =
        '<tr>' +
        '<th style="width: 35px;" class="center">No</th>' +
        '<th style="min-width: 190px;">Nama Asesor</th>' +
        '<th style="min-width: 140px;">Asal Kabupaten Asesor</th>' +
        '<th style="width: 110px;" class="center">Jumlah Sekolah yang Dinilai</th>' +
        '<th style="width: 100px;" class="center">Total Penilaian</th>' +
        '<th style="width: 140px;" class="center">Jumlah Penilaian yang Sudah Selesai</th>' +
        '<th style="width: 140px;" class="center">Jumlah Penilaian yang Belum Selesai</th>' +
        '</tr>';
    }

    tbody.innerHTML = '';
    if (rekapAsesor.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: #64748b;">Tidak ada data rekapitulasi asesor yang sesuai kriteria filter.</td></tr>';
      if (tfoot) tfoot.style.display = 'none';
      return;
    }

    rekapAsesor.forEach(function (item, idx) {
      const tr = document.createElement('tr');
      const hpMarkup = (item.hp && item.hp !== '-')
        ? '<div style="font-size:0.7rem; color:#64748b; font-family:monospace;">HP: ' + item.hp + '</div>'
        : '<div style="font-size:0.7rem; color:#94a3b8; font-family:monospace;">HP: -</div>';

      tr.innerHTML =
        '<td class="center nowrap" style="font-weight:600;">' + (idx + 1) + '</td>' +
        '<td>' +
        '<div style="font-weight:700; color: #0f172a;">' + item.nama + '</div>' +
        '<div style="font-size:0.7rem; color:#64748b; font-family:monospace;">NIA: ' + item.nia + '</div>' +
        hpMarkup +
        '</td>' +
        '<td>' + item.kabupaten + '</td>' +
        '<td class="center nowrap" style="font-weight:700; font-size:0.85rem; color: #0f172a;">' + item.totalSekolah + ' Sekolah</td>' +
        '<td class="center nowrap" style="font-weight:700; font-size:0.85rem;">' + item.totalPenilaian + '</td>' +
        '<td class="center nowrap"><span class="print-badge selesai" style="font-size:0.75rem; padding: 3px 8px;">' + item.selesai + ' Selesai</span></td>' +
        '<td class="center nowrap"><span class="print-badge ' + (item.belum > 0 ? 'belum' : 'selesai') + '" style="font-size:0.75rem; padding: 3px 8px;">' + item.belum + ' Belum</span></td>';
      tbody.appendChild(tr);
    });

    // Pasang tfoot baris total rekapitulasi
    if (tfoot) {
      tfoot.style.display = 'table-footer-group';
      tfoot.innerHTML =
        '<tr style="background:#f1f5f9; font-weight:700; border-top: 2px solid #64748b;">' +
        '<td colspan="3" style="text-align:right; padding-right: 1rem; font-weight:700; letter-spacing:0.02em;">TOTAL REKAPITULASI (' + rekapAsesor.length + ' ASESOR):</td>' +
        '<td class="center nowrap" style="font-weight:800; font-size:0.9rem; color: #0f172a;">' + grandTotalSekolah + ' Sekolah</td>' +
        '<td class="center nowrap" style="font-weight:800; font-size:0.9rem;">' + grandTotalPenilaian + '</td>' +
        '<td class="center nowrap"><span class="print-badge selesai" style="font-weight:800; font-size:0.75rem; padding: 3px 8px;">' + grandTotalSelesai + ' Selesai</span></td>' +
        '<td class="center nowrap"><span class="print-badge ' + (grandTotalBelum > 0 ? 'belum' : 'selesai') + '" style="font-weight:800; font-size:0.75rem; padding: 3px 8px;">' + grandTotalBelum + ' Belum</span></td>' +
        '</tr>';
    }

  } else {
    // ========================================================
    // FORMAT 1: DOKUMEN LENGKAP (15 KOLOM SATUAN PENDIDIKAN)
    // ========================================================
    if (docSublembaga) docSublembaga.textContent = 'SISTEM MONITORING & EVALUASI PENILAIAN VISITASI AKREDITASI ASESOR';
    if (docAlamat) docAlamat.textContent = 'Laporan Penugasan Asesor 1 & Asesor 2 Wilayah Akreditasi Satuan Pendidikan Provinsi NTT';
    if (countMetaLabel) countMetaLabel.textContent = 'Total Sekolah Terdata:';
    if (rateMetaLabel) rateMetaLabel.textContent = 'Tingkat Penyelesaian:';

    if (tfoot) tfoot.style.display = 'none';

    let filtered = APP_STATE.items.filter(function (item) {
      const match1 = filterAsesor !== 'ALL' && ((item.namaAsesor1 && item.namaAsesor1.trim().toUpperCase() === filterAsesor) || (item.nia1 && item.nia1.trim().toUpperCase() === filterAsesor));
      const match2 = filterAsesor !== 'ALL' && ((item.namaAsesor2 && item.namaAsesor2.trim().toUpperCase() === filterAsesor) || (item.nia2 && item.nia2.trim().toUpperCase() === filterAsesor));

      if (filterAsesor !== 'ALL' && !match1 && !match2) return false;
      if (filterJenjang !== 'ALL' && item.jenjang !== filterJenjang) return false;
      if (filterTahap !== 'ALL' && item.tahap !== filterTahap) return false;

      if (filterStatus !== 'ALL') {
        if (filterAsesor !== 'ALL') {
          let tCount = 0;
          let sCount = 0;
          if (match1) {
            tCount += 2;
            if (item.status1 === 'SELESAI') sCount++;
            if (item.statusKelompok === 'SELESAI') sCount++;
          }
          if (match2) {
            tCount += 1;
            if (item.status2 === 'SELESAI') sCount++;
          }
          if (filterStatus === 'SELESAI' && (sCount < tCount || tCount === 0)) return false;
          if (filterStatus === 'BELUM' && sCount === tCount) return false;
        } else {
          const allDone = (item.status1 === 'SELESAI' && item.status2 === 'SELESAI' && item.statusKelompok === 'SELESAI');
          if (filterStatus === 'SELESAI' && !allDone) return false;
          if (filterStatus === 'BELUM' && allDone) return false;
        }
      }
      return true;
    });

    document.getElementById('printCountMeta').textContent = filtered.length + ' Satuan Pendidikan';

    let totalPoints = 0;
    let completedPoints = 0;
    filtered.forEach(function (x) {
      if (filterAsesor !== 'ALL') {
        const m1 = ((x.namaAsesor1 && x.namaAsesor1.trim().toUpperCase() === filterAsesor) || (x.nia1 && x.nia1.trim().toUpperCase() === filterAsesor));
        const m2 = ((x.namaAsesor2 && x.namaAsesor2.trim().toUpperCase() === filterAsesor) || (x.nia2 && x.nia2.trim().toUpperCase() === filterAsesor));
        if (m1) {
          totalPoints += 2;
          if (x.status1 === 'SELESAI') completedPoints++;
          if (x.statusKelompok === 'SELESAI') completedPoints++;
        }
        if (m2) {
          totalPoints += 1;
          if (x.status2 === 'SELESAI') completedPoints++;
        }
      } else {
        totalPoints += 3;
        if (x.status1 === 'SELESAI') completedPoints++;
        if (x.statusKelompok === 'SELESAI') completedPoints++;
        if (x.status2 === 'SELESAI') completedPoints++;
      }
    });
    const rate = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
    document.getElementById('printRateMeta').textContent = rate + '% (' + completedPoints + '/' + totalPoints + ' Penilaian)';

    // Pasang thead 15 kolom
    if (thead) {
      thead.innerHTML =
        '<tr>' +
        '<th rowspan="2" style="width: 25px;">No</th>' +
        '<th rowspan="2">NPSN</th>' +
        '<th rowspan="2">Nama Sekolah</th>' +
        '<th rowspan="2">Jenjang</th>' +
        '<th rowspan="2">Tahap</th>' +
        '<th rowspan="2">Kab/Kota</th>' +
        '<th colspan="3">Asesor 1</th>' +
        '<th colspan="3">Asesor 2</th>' +
        '<th colspan="3">Status Penilaian</th>' +
        '</tr>' +
        '<tr>' +
        '<th>NIA</th>' +
        '<th>Nama Asesor 1</th>' +
        '<th>Kab/Kota</th>' +
        '<th>NIA</th>' +
        '<th>Nama Asesor 2</th>' +
        '<th>Kab/Kota</th>' +
        '<th>Asesor 1</th>' +
        '<th>Asesor 2</th>' +
        '<th>Kelompok</th>' +
        '</tr>';
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 2rem;">Tidak ada data laporan yang sesuai filter.</td></tr>';
      return;
    }

    filtered.forEach(function (item, idx) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="center nowrap">' + (idx + 1) + '</td>' +
        '<td class="center nowrap" style="font-family:monospace; font-weight:600;">' + item.npsn + '</td>' +
        '<td style="font-weight:600;">' + item.namaSekolah + '</td>' +
        '<td class="center nowrap">' + item.jenjang + '</td>' +
        '<td class="center nowrap" style="font-weight:600;">' + (item.tahap || 'Tahap 1') + '</td>' +
        '<td>' + item.kabSekolah + '</td>' +
        '<td class="center nowrap">' + item.nia1 + '</td>' +
        '<td>' + item.namaAsesor1 + '</td>' +
        '<td>' + item.kabAsesor1 + '</td>' +
        '<td class="center nowrap">' + item.nia2 + '</td>' +
        '<td>' + item.namaAsesor2 + '</td>' +
        '<td>' + item.kabAsesor2 + '</td>' +
        '<td class="center nowrap"><span class="print-badge ' + (item.status1 === 'SELESAI' ? 'selesai' : 'belum') + '">' + item.status1 + '</span></td>' +
        '<td class="center nowrap"><span class="print-badge ' + (item.status2 === 'SELESAI' ? 'selesai' : 'belum') + '">' + item.status2 + '</span></td>' +
        '<td class="center nowrap"><span class="print-badge ' + (item.statusKelompok === 'SELESAI' ? 'selesai' : 'belum') + '">' + item.statusKelompok + '</span></td>';

      tbody.appendChild(tr);
    });
  }
}

/**
 * Helper Penamaan File PDF Otomatis Berisi Tanggal Download & Kategori (v1.0.73)
 */
let originalPageTitle = '';
let isPrintTitleActive = false;

function getPrintPdfFileName(type) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = year + '-' + month + '-' + day;

  if (type === 'penugasan') {
    const filterWilayah = document.getElementById('penugasanFilterWilayah');
    let extra = '';
    if (filterWilayah && filterWilayah.value && filterWilayah.value !== 'ALL') {
      extra = '_' + filterWilayah.value.trim().replace(/[^a-zA-Z0-9]/g, '_');
    }
    return 'Rekapitulasi_Penugasan_Asesor_BAN_PDM_NTT' + extra + '_' + dateStr;
  }

  // type === 'laporan'
  const formatDokumen = document.getElementById('printFormatDokumen') ? document.getElementById('printFormatDokumen').value : 'LENGKAP';
  const filterAsesor = document.getElementById('printFilterAsesor') ? document.getElementById('printFilterAsesor').value : 'ALL';
  let asesorSlug = '';
  if (filterAsesor && filterAsesor !== 'ALL') {
    const a = (APP_STATE.daftarAsesor || []).find(function (x) { return x.id === filterAsesor; });
    if (a && a.nama) {
      asesorSlug = '_' + a.nama.trim().replace(/[^a-zA-Z0-9]/g, '_');
    }
  }
  const filterTahap = document.getElementById('printFilterTahap') ? document.getElementById('printFilterTahap').value : 'ALL';
  let tahapSlug = (filterTahap && filterTahap !== 'ALL') ? ('_' + filterTahap.trim().replace(/[^a-zA-Z0-9]/g, '_')) : '';

  if (formatDokumen === 'RINGKAS') {
    return 'Rekapitulasi_Penilaian_Asesor_BAN_PDM_NTT' + tahapSlug + '_' + dateStr;
  } else {
    return 'Laporan_Penilaian_Asesor_BAN_PDM_NTT' + asesorSlug + tahapSlug + '_' + dateStr;
  }
}

function setDocumentTitleForPrint(fileName) {
  if (!originalPageTitle) originalPageTitle = document.title;
  document.title = fileName;
  try {
    if (window.top && window.top.document) {
      window.top.document.title = fileName;
    }
  } catch (e) { }
  isPrintTitleActive = true;
}

function restoreDocumentTitleAfterPrint() {
  if (!isPrintTitleActive) return;
  isPrintTitleActive = false;
  if (originalPageTitle) {
    document.title = originalPageTitle;
    try {
      if (window.top && window.top.document) {
        window.top.document.title = originalPageTitle;
      }
    } catch (e) { }
  }
}

/**
 * Memicu Fungsi Cetak Standar Browser (Ctrl+P / Direct Print) dengan Penamaan File PDF Berisi Tanggal Download
 */
function triggerPrint() {
  // 1. Sinkronkan tanggal cetak/unduh terbaru pada metadata lembar dokumen
  const now = new Date();
  const todayStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const printDateEl = document.getElementById('printDateMeta');
  if (printDateEl) printDateEl.textContent = todayStr;
  const sigDateEl = document.getElementById('sigDateLabel');
  if (sigDateEl) sigDateEl.textContent = 'Kupang, ' + now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  // 2. Format tanggal & nama file otomatis hasil download PDF
  const pdfFileName = getPrintPdfFileName('laporan');
  setDocumentTitleForPrint(pdfFileName);

  // Kembalikan judul halaman semula setelah dialog cetak/simpan PDF selesai
  const onAfterPrint = function () {
    restoreDocumentTitleAfterPrint();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  window.print();

  // Proteksi fallback waktu aman 60 detik (bukan 1.5 detik) agar browser sempat memproses Save as PDF
  setTimeout(function () {
    restoreDocumentTitleAfterPrint();
  }, 60000);
}

/**
 * Menghitung lebar kolom otomatis (Auto-fit Column Widths) untuk Worksheet SheetJS
 * @param {Array<Array<any>>} data - Matriks data sheet termasuk baris judul/header
 * @returns {Array<{wch: number}>} Array lebar kolom dengan batas aman
 */
function calculateSheetColWidths(data) {
  if (!data || data.length === 0) return [];
  const colWidths = [];
  const numCols = data[0].length;

  for (let c = 0; c < numCols; c++) {
    let maxLen = 0;
    for (let r = 0; r < data.length; r++) {
      const val = data[r][c];
      if (val !== null && val !== undefined) {
        const strVal = String(val);
        if (strVal.length > maxLen) {
          maxLen = strVal.length;
        }
      }
    }
    colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 10), 60) });
  }
  return colWidths;
}

/**
 * Ekspor Data ke File Microsoft Excel Asli (.xlsx) Lengkap dengan Struktur Tabel
 * Menyesuaikan dengan format dokumen yang dipilih: LENGKAP (15 kolom) atau RINGKAS (7 kolom)
 */
function exportToExcel() {
  const formatDokumen = document.getElementById('printFormatDokumen') ? document.getElementById('printFormatDokumen').value : 'LENGKAP';
  const filterAsesor = document.getElementById('printFilterAsesor').value;
  const filterJenjang = document.getElementById('printFilterJenjang').value;
  const filterStatus = document.getElementById('printFilterStatus').value;
  const filterTahap = document.getElementById('printFilterTahap') ? document.getElementById('printFilterTahap').value : 'ALL';

  if (formatDokumen === 'RINGKAS') {
    // MODE 2: EKSPOR REKAPITULASI 7 KOLOM ASESOR
    let scopedSchools = APP_STATE.items.filter(function (item) {
      if (filterJenjang !== 'ALL' && item.jenjang !== filterJenjang) return false;
      if (filterTahap !== 'ALL' && item.tahap !== filterTahap) return false;
      return true;
    });

    let asesorList = APP_STATE.daftarAsesor;
    if (filterAsesor !== 'ALL') {
      asesorList = asesorList.filter(function (a) { return a.id === filterAsesor; });
    }

    let rekapAsesor = [];
    asesorList.forEach(function (a) {
      let totalBeban = 0;
      let selesai = 0;
      let belum = 0;

      let uniqueSchools = {};
      let totalSekolah = 0;

      scopedSchools.forEach(function (s) {
        const isAsesor1 = ((s.namaAsesor1 && s.namaAsesor1.trim().toUpperCase() === a.id) || (s.nia1 && s.nia1.trim().toUpperCase() === a.id));
        const isAsesor2 = ((s.namaAsesor2 && s.namaAsesor2.trim().toUpperCase() === a.id) || (s.nia2 && s.nia2.trim().toUpperCase() === a.id));

        if (isAsesor1) {
          totalBeban += 2;
          if (s.status1 === 'SELESAI') selesai++; else belum++;
          if (s.statusKelompok === 'SELESAI') selesai++; else belum++;
        }
        if (isAsesor2) {
          totalBeban += 1;
          if (s.status2 === 'SELESAI') selesai++; else belum++;
        }
        if (isAsesor1 || isAsesor2) {
          const sKey = String(s.npsn || s.namaSekolah || s.no).trim();
          if (sKey && !uniqueSchools[sKey]) {
            uniqueSchools[sKey] = true;
            totalSekolah++;
          }
        }
      });

      if ((filterJenjang !== 'ALL' || filterTahap !== 'ALL') && totalBeban === 0) {
        return;
      }

      if (filterStatus === 'BELUM') {
        if (belum === 0) return;
      } else if (filterStatus === 'SELESAI') {
        if (belum > 0 || totalBeban === 0) return;
      }

      rekapAsesor.push({
        nama: a.nama,
        nia: a.nia,
        kabupaten: a.kabupaten || '-',
        totalSekolah: totalSekolah,
        totalPenilaian: totalBeban,
        selesai: selesai,
        belum: belum
      });
    });

    if (rekapAsesor.length === 0) {
      showToast('Tidak ada data rekapitulasi untuk diekspor', true);
      return;
    }

    const headers = [
      'No',
      'Nama Asesor',
      'NIA Asesor',
      'Asal Kabupaten Asesor',
      'Jumlah Sekolah yang Dinilai',
      'Total Penilaian',
      'Jumlah Penilaian yang Sudah Selesai',
      'Jumlah Penilaian yang Belum Selesai'
    ];

    const sheetData = [headers];
    rekapAsesor.forEach(function (item, idx) {
      sheetData.push([
        idx + 1,
        item.nama || '-',
        String(item.nia || '-'),
        item.kabupaten || '-',
        Number(item.totalSekolah) || 0,
        Number(item.totalPenilaian) || 0,
        Number(item.selesai) || 0,
        Number(item.belum) || 0
      ]);
    });

    try {
      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = calculateSheetColWidths(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi_Asesor');
        const filename = 'Rekapitulasi_Penilaian_Asesor_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('File rekapitulasi asesor Excel (.xlsx) berhasil diunduh');
        return;
      }
    } catch (err) {
      console.warn('SheetJS error, menggunakan fallback CSV:', err);
    }

    // Fallback CSV jika SheetJS belum terload
    const csvRows = [headers.join(',')];
    rekapAsesor.forEach(function (item, idx) {
      const row = [
        idx + 1,
        '"' + String(item.nama || '').replace(/"/g, '""') + '"',
        '"' + String(item.nia || '') + '"',
        '"' + String(item.kabupaten || '').replace(/"/g, '""') + '"',
        item.totalSekolah,
        item.totalPenilaian,
        item.selesai,
        item.belum
      ];
      csvRows.push(row.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Rekapitulasi_Penilaian_Asesor_' + new Date().toISOString().slice(0, 10) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('File rekapitulasi asesor CSV berhasil diunduh');

  } else {
    // MODE 1: EKSPOR LENGKAP 15 KOLOM
    let filtered = APP_STATE.items.filter(function (item) {
      const match1 = filterAsesor !== 'ALL' && ((item.namaAsesor1 && item.namaAsesor1.trim().toUpperCase() === filterAsesor) || (item.nia1 && item.nia1.trim().toUpperCase() === filterAsesor));
      const match2 = filterAsesor !== 'ALL' && ((item.namaAsesor2 && item.namaAsesor2.trim().toUpperCase() === filterAsesor) || (item.nia2 && item.nia2.trim().toUpperCase() === filterAsesor));

      if (filterAsesor !== 'ALL' && !match1 && !match2) return false;
      if (filterJenjang !== 'ALL' && item.jenjang !== filterJenjang) return false;
      if (filterTahap !== 'ALL' && item.tahap !== filterTahap) return false;

      if (filterStatus !== 'ALL') {
        if (filterAsesor !== 'ALL') {
          let tCount = 0;
          let sCount = 0;
          if (match1) {
            tCount += 2;
            if (item.status1 === 'SELESAI') sCount++;
            if (item.statusKelompok === 'SELESAI') sCount++;
          }
          if (match2) {
            tCount += 1;
            if (item.status2 === 'SELESAI') sCount++;
          }
          if (filterStatus === 'SELESAI' && (sCount < tCount || tCount === 0)) return false;
          if (filterStatus === 'BELUM' && sCount === tCount) return false;
        } else {
          const allDone = (item.status1 === 'SELESAI' && item.status2 === 'SELESAI' && item.statusKelompok === 'SELESAI');
          if (filterStatus === 'SELESAI' && !allDone) return false;
          if (filterStatus === 'BELUM' && allDone) return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', true);
      return;
    }

    const headers = [
      'No', 'NPSN', 'Nama Sekolah', 'Jenjang', 'Tahap', 'Kab/Kota Sekolah',
      'NIA Asesor 1', 'Nama Asesor 1', 'Kab/Kota Asesor 1',
      'NIA Asesor 2', 'Nama Asesor 2', 'Kab/Kota Asesor 2',
      'Nilai Asesor 1', 'Nilai Asesor 2', 'Nilai Kelompok'
    ];

    const sheetData = [headers];
    filtered.forEach(function (item, idx) {
      sheetData.push([
        idx + 1,
        String(item.npsn || ''),
        item.namaSekolah || '-',
        item.jenjang || '-',
        item.tahap || 'Tahap 1',
        item.kabSekolah || '-',
        String(item.nia1 || '-'),
        item.namaAsesor1 || '-',
        item.kabAsesor1 || '-',
        String(item.nia2 || '-'),
        item.namaAsesor2 || '-',
        item.kabAsesor2 || '-',
        item.status1 || 'BELUM',
        item.status2 || 'BELUM',
        item.statusKelompok || 'BELUM'
      ]);
    });

    try {
      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = calculateSheetColWidths(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rincian_Penilaian');
        const filename = 'Laporan_Penilaian_Asesor_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('File laporan Excel (.xlsx) berhasil diunduh');
        return;
      }
    } catch (err) {
      console.warn('SheetJS error, menggunakan fallback CSV:', err);
    }

    // Fallback CSV jika SheetJS belum terload
    const csvRows = [headers.join(',')];
    filtered.forEach(function (item, idx) {
      const row = [
        idx + 1,
        '"' + item.npsn + '"',
        '"' + item.namaSekolah.replace(/"/g, '""') + '"',
        '"' + item.jenjang + '"',
        '"' + (item.tahap || 'Tahap 1') + '"',
        '"' + item.kabSekolah.replace(/"/g, '""') + '"',
        '"' + item.nia1 + '"',
        '"' + item.namaAsesor1.replace(/"/g, '""') + '"',
        '"' + item.kabAsesor1.replace(/"/g, '""') + '"',
        '"' + item.nia2 + '"',
        '"' + item.namaAsesor2.replace(/"/g, '""') + '"',
        '"' + item.kabAsesor2.replace(/"/g, '""') + '"',
        '"' + item.status1 + '"',
        '"' + item.status2 + '"',
        '"' + item.statusKelompok + '"'
      ];
      csvRows.push(row.join(','));
    });

    // Tambahkan UTF-8 BOM agar terbaca sempurna di Microsoft Excel
    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Laporan_Penilaian_Asesor_' + new Date().toISOString().slice(0, 10) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('File laporan CSV berhasil diunduh');
  }
}

/**
 * Alias backward-compatibility untuk exportToCsv
 */
function exportToCsv() {
  exportToExcel();
}

/* ==========================================================================
   MODUL PENUGASAN ASESOR (KHUSUS ADMIN)
   ========================================================================== */
/**
 * Mengisi dropdown dan filter wilayah pada Tab Penugasan Asesor
 */
function populatePenugasanDropdown() {
  const selectAsesor = document.getElementById('penugasanSelectAsesor');
  const selectWilayah = document.getElementById('penugasanFilterWilayah');
  const searchInp = document.getElementById('penugasanSearchInput');
  const searchQuery = (searchInp ? searchInp.value : '').trim().toLowerCase();
  const currentSelected = selectAsesor ? selectAsesor.value : 'ALL';

  // Dropdown Asesor
  if (selectAsesor) {
    selectAsesor.innerHTML = '<option value="ALL">-- Semua Asesor (Rekap Seluruh Penugasan) --</option>';
    APP_STATE.daftarAsesor.forEach(function (a) {
      const matchQuery = !searchQuery ||
        (a.nama || '').toLowerCase().includes(searchQuery) ||
        (a.nia || '').toLowerCase().includes(searchQuery);

      if (matchQuery) {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.nama + ' (NIA: ' + (a.nia || '-') + ' | ' + a.kabupaten + ') - ' + a.totalTugas + ' Penugasan';
        if (a.id === currentSelected) opt.selected = true;
        selectAsesor.appendChild(opt);
      }
    });
  }

  // Dropdown Wilayah Kolom E (Kab/Kota Satuan Pendidikan)
  if (selectWilayah) {
    const curWil = selectWilayah.value || 'ALL';
    const wilSet = new Set();
    APP_STATE.items.forEach(function (it) {
      if (it.kabSekolah && it.kabSekolah.trim()) {
        wilSet.add(it.kabSekolah.trim().toUpperCase());
      }
    });
    selectWilayah.innerHTML = '<option value="ALL">Lintas Wilayah</option>';
    Array.from(wilSet).filter(Boolean).sort().forEach(function (w) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      if (w === curWil) opt.selected = true;
      selectWilayah.appendChild(opt);
    });
  }
}

/**
 * Handler pencarian realtime pada kolom pencarian penugasan
 */
function onPenugasanSearch(query) {
  populatePenugasanDropdown();
  renderPenugasanData();
}

/**
 * Handler perubahan dropdown asesor terpilih
 */
function onPenugasanSelectChange() {
  renderPenugasanData();
}

/**
 * Mengambil daftar asesor yang disaring berdasarkan pilihan kontrol
 */
function getFilteredAsesorList() {
  const selectAsesor = document.getElementById('penugasanSelectAsesor');
  const selectedAsesorId = selectAsesor ? selectAsesor.value : 'ALL';
  const searchInp = document.getElementById('penugasanSearchInput');
  const searchQuery = (searchInp ? searchInp.value : '').trim().toLowerCase();
  const filterTahap = document.getElementById('penugasanFilterTahap') ? document.getElementById('penugasanFilterTahap').value : 'ALL';
  const filterWilayah = document.getElementById('penugasanFilterWilayah') ? document.getElementById('penugasanFilterWilayah').value : 'ALL';

  const results = [];

  (APP_STATE.daftarAsesor || []).forEach(function (a) {
    // Cek filter dropdown pilihan asesor
    if (selectedAsesorId !== 'ALL' && a.id !== selectedAsesorId) {
      return;
    }

    // Cek pencarian nama / NIA / Asal Kabupaten Asesor
    if (searchQuery) {
      const match = (a.nama || '').toLowerCase().includes(searchQuery) ||
        (a.nia || '').toLowerCase().includes(searchQuery) ||
        (a.kabupaten || '').toLowerCase().includes(searchQuery);
      if (!match) return;
    }

    // Hitung berapa kali nama asesor ini muncul di baris sekolah (kolom Asesor 1 & Asesor 2)
    let countTugas = 0;
    let countSelesai = 0;
    let countBelum = 0;

    APP_STATE.items.forEach(function (item) {
      if (filterTahap !== 'ALL' && item.tahap !== filterTahap) return;
      if (filterWilayah !== 'ALL' && (item.kabSekolah || '').trim().toUpperCase() !== filterWilayah.toUpperCase()) return;

      const n1 = (item.namaAsesor1 || '').trim().toUpperCase();
      const nia1 = (item.nia1 || '').trim().toUpperCase();
      const n2 = (item.namaAsesor2 || '').trim().toUpperCase();
      const nia2 = (item.nia2 || '').trim().toUpperCase();

      const is1 = (n1 === a.id || (a.nia && a.nia !== '-' && nia1 === a.nia.toUpperCase()));
      const is2 = (n2 === a.id || (a.nia && a.nia !== '-' && nia2 === a.nia.toUpperCase()));

      if (is1) {
        countTugas++;
        if (item.status1 === 'SELESAI') countSelesai++; else countBelum++;
        if (item.statusKelompok === 'SELESAI') countSelesai++; else countBelum++;
      }
      if (is2) {
        countTugas++;
        if (item.status2 === 'SELESAI') countSelesai++; else countBelum++;
      }
    });

    // Jika ada filter tahap atau wilayah, lewatkan asesor yang tidak ada penugasan di filter tersebut
    if ((filterTahap !== 'ALL' || filterWilayah !== 'ALL') && countTugas === 0) {
      return;
    }

    const finalTugas = (filterTahap !== 'ALL' || filterWilayah !== 'ALL') ? countTugas : a.totalTugas;
    const finalSelesai = (filterTahap !== 'ALL' || filterWilayah !== 'ALL') ? countSelesai : a.selesai;
    const finalBelum = (filterTahap !== 'ALL' || filterWilayah !== 'ALL') ? countBelum : a.belum;

    results.push({
      id: a.id,
      nama: a.nama,
      nia: a.nia || '-',
      kabupaten: a.kabupaten || '-',
      totalPenugasan: finalTugas,
      selesai: finalSelesai,
      belum: finalBelum
    });
  });

  return results;
}

/**
 * Render data tabel, ringkasan profil, dan metadata cetak penugasan
 */
function renderPenugasanData() {
  const selectAsesor = document.getElementById('penugasanSelectAsesor');
  const selectedAsesorId = selectAsesor ? selectAsesor.value : 'ALL';
  const searchInp = document.getElementById('penugasanSearchInput');
  const searchQuery = (searchInp ? searchInp.value : '').trim();
  const filterTahap = document.getElementById('penugasanFilterTahap') ? document.getElementById('penugasanFilterTahap').value : 'ALL';
  const filterWilayah = document.getElementById('penugasanFilterWilayah') ? document.getElementById('penugasanFilterWilayah').value : 'ALL';

  const matchedAsesors = getFilteredAsesorList();

  let totalPenugasanSemua = 0;
  let totalSelesaiSemua = 0;
  let totalBelumSemua = 0;
  matchedAsesors.forEach(function (a) {
    totalPenugasanSemua += a.totalPenugasan;
    totalSelesaiSemua += a.selesai;
    totalBelumSemua += a.belum;
  });

  // Update Profile Summary Card
  const profName = document.getElementById('penugasanProfileName');
  const profMeta = document.getElementById('penugasanProfileMeta');
  const statSekolah = document.getElementById('penugasanStatSekolah');
  const statSelesai = document.getElementById('penugasanStatSelesai');
  const statBelum = document.getElementById('penugasanStatBelum');

  if (matchedAsesors.length === 1) {
    const single = matchedAsesors[0];
    if (profName) profName.textContent = single.nama + ' (NIA: ' + single.nia + ')';
    if (profMeta) profMeta.textContent = 'Asal Kabupaten: ' + single.kabupaten + ' | Total Beban Penugasan: ' + single.totalPenugasan + ' Penugasan di Sekolah';
  } else {
    if (profName) profName.textContent = searchQuery ? 'Hasil Pencarian Asesor: "' + searchQuery + '"' : 'Rekapitulasi Penugasan Asesor';
    if (profMeta) profMeta.textContent = 'Menampilkan ' + matchedAsesors.length + ' Asesor BAN PDM Provinsi NTT (Total ' + totalPenugasanSemua + ' penugasan di sekolah)';
  }

  if (statSekolah) statSekolah.textContent = totalPenugasanSemua;
  if (statSelesai) statSelesai.textContent = totalSelesaiSemua;
  if (statBelum) statBelum.textContent = totalBelumSemua >= 0 ? totalBelumSemua : 0;

  // Update Metadata Kop Pratinjau Cetak
  const metaAsesor = document.getElementById('penugasanMetaAsesor');
  const metaTotal = document.getElementById('penugasanMetaTotal');
  const metaDate = document.getElementById('penugasanMetaDate');
  const metaSync = document.getElementById('penugasanMetaSync');
  const metaTahap = document.getElementById('penugasanMetaTahap');
  const metaWilayah = document.getElementById('penugasanMetaWilayah');
  const sigDate = document.getElementById('penugasanSigDate');

  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const simpleToday = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  if (metaAsesor) metaAsesor.textContent = matchedAsesors.length === 1 ? matchedAsesors[0].nama + ' (NIA: ' + matchedAsesors[0].nia + ')' : (searchQuery ? 'Pencarian: ' + searchQuery : 'Semua Asesor (' + matchedAsesors.length + ' Orang)');
  if (metaTotal) metaTotal.textContent = totalPenugasanSemua + ' Penugasan';
  if (metaDate) metaDate.textContent = todayStr;
  if (metaSync) metaSync.textContent = APP_STATE.lastSyncTimestamp || '-';
  if (metaTahap) metaTahap.textContent = filterTahap === 'ALL' ? 'Semua Tahap (1 s.d. 5)' : filterTahap;
  if (metaWilayah) metaWilayah.textContent = filterWilayah === 'ALL' ? 'Semua Wilayah' : filterWilayah;
  if (sigDate) sigDate.textContent = 'Kupang, ' + simpleToday;

  // Render Table Rows (4 Kolom Sesuai Permintaan Revisi)
  const tbody = document.getElementById('penugasanTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (matchedAsesors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="center" style="padding: 2rem; color: #94a3b8;">Tidak ada data penugasan asesor yang sesuai dengan filter/pencarian ini.</td></tr>';
    return;
  }

  matchedAsesors.forEach(function (asesor, idx) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="center">' + (idx + 1) + '</td>' +
      '<td>' +
      '<strong>' + asesor.nama + '</strong>' +
      (asesor.nia && asesor.nia !== '-' ? '<span style="display: block; font-size: 0.775rem; color: #64748b;">NIA: ' + asesor.nia + '</span>' : '') +
      '</td>' +
      '<td>' + (asesor.kabupaten || '-') + '</td>' +
      '<td class="center"><span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 0.85rem; padding: 4px 12px; border-radius: 6px; display: inline-block;">' + asesor.totalPenugasan + ' Penugasan</span></td>';
    tbody.appendChild(tr);
  });
}

/**
 * Memicu Cetak Dokumen Penugasan Asesor ke PDF (A4 Landscape) dengan Penamaan File PDF Berisi Tanggal Download
 */
function triggerPrintPenugasan() {
  // 1. Sinkronkan tanggal cetak/unduh terbaru pada metadata penugasan
  const now = new Date();
  const todayStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const metaDate = document.getElementById('penugasanMetaDate');
  if (metaDate) metaDate.textContent = todayStr;
  const sigDateEl = document.getElementById('penugasanSigDate');
  if (sigDateEl) sigDateEl.textContent = 'Kupang, ' + now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  // 2. Format tanggal & nama file otomatis hasil download PDF
  const pdfFileName = getPrintPdfFileName('penugasan');
  setDocumentTitleForPrint(pdfFileName);

  const onAfterPrint = function () {
    restoreDocumentTitleAfterPrint();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  window.print();

  // Proteksi fallback waktu aman 60 detik (bukan 1.5 detik) agar browser sempat memproses Save as PDF
  setTimeout(function () {
    restoreDocumentTitleAfterPrint();
  }, 60000);
}

// Listener Global Pencetakan Browser (Ctrl+P / Menu Cetak Browser - v1.0.73)
window.addEventListener('beforeprint', function () {
  const now = new Date();
  const todayStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todaySig = 'Kupang, ' + now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  const tabPenugasan = document.getElementById('tab-penugasan');
  const isPenugasanActive = tabPenugasan && (tabPenugasan.classList.contains('active') || tabPenugasan.style.display === 'block');

  if (isPenugasanActive) {
    const metaDate = document.getElementById('penugasanMetaDate');
    if (metaDate) metaDate.textContent = todayStr;
    const sigDateEl = document.getElementById('penugasanSigDate');
    if (sigDateEl) sigDateEl.textContent = todaySig;
    setDocumentTitleForPrint(getPrintPdfFileName('penugasan'));
  } else {
    const printDateEl = document.getElementById('printDateMeta');
    if (printDateEl) printDateEl.textContent = todayStr;
    const sigDateEl = document.getElementById('sigDateLabel');
    if (sigDateEl) sigDateEl.textContent = todaySig;
    setDocumentTitleForPrint(getPrintPdfFileName('laporan'));
  }
});

window.addEventListener('afterprint', function () {
  restoreDocumentTitleAfterPrint();
});

/**
 * Ekspor Data Penugasan Asesor ke File Microsoft Excel Asli (.xlsx) Lengkap dengan Struktur Tabel
 */
function exportPenugasanToExcel() {
  const matchedAsesors = getFilteredAsesorList();

  if (matchedAsesors.length === 0) {
    showToast('Tidak ada data penugasan asesor untuk diekspor', true);
    return;
  }

  const headers = [
    'No', 'Nama Asesor', 'NIA Asesor', 'Asal Kabupaten Asesor', 'Total Penugasan Sekolah'
  ];

  const sheetData = [headers];
  matchedAsesors.forEach(function (asesor, idx) {
    sheetData.push([
      idx + 1,
      asesor.nama || '-',
      String(asesor.nia || '-'),
      asesor.kabupaten || '-',
      Number(asesor.totalPenugasan) || 0
    ]);
  });

  try {
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = calculateSheetColWidths(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Penugasan_Asesor');
      const filename = 'Laporan_Rekap_Penugasan_Asesor_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      XLSX.writeFile(wb, filename);
      showToast('File laporan rekap penugasan asesor Excel (.xlsx) berhasil diunduh');
      return;
    }
  } catch (err) {
    console.warn('SheetJS error, menggunakan fallback CSV:', err);
  }

  // Fallback CSV jika SheetJS belum terload
  const csvRows = [headers.join(',')];
  matchedAsesors.forEach(function (asesor, idx) {
    const row = [
      idx + 1,
      '"' + String(asesor.nama || '-').replace(/"/g, '""') + '"',
      '"' + String(asesor.nia || '-') + '"',
      '"' + String(asesor.kabupaten || '-').replace(/"/g, '""') + '"',
      asesor.totalPenugasan
    ];
    csvRows.push(row.join(','));
  });

  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Laporan_Rekap_Penugasan_Asesor_' + new Date().toISOString().slice(0, 10) + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('File laporan rekap penugasan asesor CSV berhasil diunduh');
}

/**
 * Alias backward-compatibility untuk exportPenugasanToCsv
 */
function exportPenugasanToCsv() {
  exportPenugasanToExcel();
}

/**
 * Inisialisasi Logo BAN PDM pada Mobile Drawer (Sinkronisasi Otomatis)
 */
function initMobileDrawerLogo() {
  const desktopLogo = document.querySelector('.top-header .brand-icon-box img');
  const drawerLogoBox = document.getElementById('mobileDrawerLogoBox');
  if (desktopLogo && drawerLogoBox && !drawerLogoBox.hasChildNodes()) {
    const clone = desktopLogo.cloneNode(true);
    drawerLogoBox.appendChild(clone);
  }
}

/**
 * Kontrol Navigasi Samping Kiri Mobile (Drawer Show/Hide)
 */
function toggleMobileDrawer(isOpen) {
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  if (!drawer || !overlay) return;

  if (isOpen) {
    initMobileDrawerLogo();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Kontrol Dropdown Menu Navbar Atas (DASHBOARD)
 */
function toggleNavDropdown(e) {
  if (e) {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  }
  const menu = document.getElementById('navDropdownMenu');
  const wrapper = document.getElementById('navDropdownWrapper');
  const toggleBtn = document.getElementById('btnNavDropdownToggle');
  if (!menu) return;
  const isOpen = menu.classList.contains('show');
  if (isOpen) {
    menu.classList.remove('show');
    if (wrapper) wrapper.classList.remove('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  } else {
    // Tutup dropdown menu Akun (ADMIN) jika sedang terbuka
    const userMenu = document.getElementById('userDropdownMenu');
    const userWrapper = document.getElementById('userDropdownWrapper');
    const userBtn = document.getElementById('userProfileBtn');
    if (userMenu) userMenu.classList.remove('show');
    if (userWrapper) userWrapper.classList.remove('open');
    if (userBtn) userBtn.setAttribute('aria-expanded', 'false');

    menu.classList.add('show');
    if (wrapper) wrapper.classList.add('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

function closeAllDropdowns() {
  const navMenu = document.getElementById('navDropdownMenu');
  const navWrapper = document.getElementById('navDropdownWrapper');
  const toggleBtn = document.getElementById('btnNavDropdownToggle');
  if (navMenu) navMenu.classList.remove('show');
  if (navWrapper) navWrapper.classList.remove('open');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');

  const userMenu = document.getElementById('userDropdownMenu');
  const userWrapper = document.getElementById('userDropdownWrapper');
  const userBtn = document.getElementById('userProfileBtn');
  if (userMenu) userMenu.classList.remove('show');
  if (userWrapper) userWrapper.classList.remove('open');
  if (userBtn) userBtn.setAttribute('aria-expanded', 'false');

  if (typeof closeTahapDropdown === 'function') closeTahapDropdown();
}

function selectNavTab(tabKey, e) {
  if (e && e.preventDefault) e.preventDefault();
  switchTab(tabKey);
  closeAllDropdowns();
}

/**
 * Kontrol Dropdown Menu Akun (ADMIN / USER & KELUAR)
 */
function toggleUserDropdown(e) {
  if (e) {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  }
  const menu = document.getElementById('userDropdownMenu');
  const wrapper = document.getElementById('userDropdownWrapper');
  const toggleBtn = document.getElementById('userProfileBtn');
  if (!menu) return;
  const isOpen = menu.classList.contains('show');
  if (isOpen) {
    menu.classList.remove('show');
    if (wrapper) wrapper.classList.remove('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  } else {
    // Tutup dropdown menu DASHBOARD jika sedang terbuka
    const navMenu = document.getElementById('navDropdownMenu');
    const navWrapper = document.getElementById('navDropdownWrapper');
    const navBtn = document.getElementById('btnNavDropdownToggle');
    if (navMenu) navMenu.classList.remove('show');
    if (navWrapper) navWrapper.classList.remove('open');
    if (navBtn) navBtn.setAttribute('aria-expanded', 'false');

    if (typeof closeTahapDropdown === 'function') closeTahapDropdown();

    menu.classList.add('show');
    if (wrapper) wrapper.classList.add('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

// Menutup dropdown saat klik di luar area menu navigasi / akun / filter tahap
document.addEventListener('click', function (e) {
  const wrapper = document.getElementById('navDropdownWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const menu = document.getElementById('navDropdownMenu');
    const toggleBtn = document.getElementById('btnNavDropdownToggle');
    if (menu) menu.classList.remove('show');
    wrapper.classList.remove('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  const userWrapper = document.getElementById('userDropdownWrapper');
  if (userWrapper && !userWrapper.contains(e.target)) {
    const userMenu = document.getElementById('userDropdownMenu');
    const userBtn = document.getElementById('userProfileBtn');
    if (userMenu) userMenu.classList.remove('show');
    userWrapper.classList.remove('open');
    if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
  }

  const tahapWrapper = document.getElementById('pillTahapWrapper');
  if (tahapWrapper && !tahapWrapper.contains(e.target)) {
    if (typeof closeTahapDropdown === 'function') closeTahapDropdown();
  }
});

/**
 * Kembali ke Halaman Utama (Dashboard) saat Logo / Brand diklik
 */
function navigateToHome(e) {
  if (e && e.preventDefault) e.preventDefault();
  // 1. Tutup semua dropdown navbar & akun jika sedang terbuka
  closeAllDropdowns();

  // 2. Tutup drawer samping mobile jika sedang terbuka
  if (typeof toggleMobileDrawer === 'function') {
    toggleMobileDrawer(false);
  }

  // 3. Pindah tab ke Dashboard (In-Memory Switching - 0 Detik)
  if (typeof switchTab === 'function') {
    switchTab('dashboard');
  }

  // 4. Scroll halus ke bagian paling atas halaman
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Navigasi Antar Tab (In-Memory Switching - 0 Detik)
 */
function switchTab(tabKey, e) {
  if (e && e.preventDefault) e.preventDefault();
  // Proteksi akses untuk akun User biasa
  if (APP_STATE.currentUserRole === 'user' && tabKey !== 'dashboard') {
    showToast('Akses dibatasi: Akun User hanya dapat melihat Dashboard', true);
    tabKey = 'dashboard';
  }

  // Hapus data-initial-tab agar kontrol visual sepenuhnya diambil alih oleh class .active
  try {
    document.documentElement.removeAttribute('data-initial-tab');
  } catch (err) { }

  // Sinkronisasi URL Hash agar link dapat di-bookmark / di-share / dibuka di tab baru
  try {
    if (history.replaceState) {
      history.replaceState(null, '', '#' + tabKey);
    } else {
      window.location.hash = tabKey;
    }
  } catch (err) {
    // Abaikan pembatasan iframe jika ada
  }

  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(function (tab) { tab.classList.remove('active'); });

  const allNavBtns = document.querySelectorAll('.nav-tab-btn, .mobile-nav-btn, .nav-dropdown-item');
  allNavBtns.forEach(function (btn) { btn.classList.remove('active'); });

  const targetTab = document.getElementById('tab-' + tabKey);
  if (targetTab) targetTab.classList.add('active');

  const activeBtns = Array.from(allNavBtns).filter(function (b) {
    return (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + tabKey + "'")) ||
      (b.getAttribute('href') && b.getAttribute('href') === '#' + tabKey);
  });
  activeBtns.forEach(function (b) { b.classList.add('active'); });

  // Update label dan ikon pada tombol pemicu dropdown navigasi atas
  const navLabels = {
    dashboard: {
      label: 'Dashboard',
      svg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
    },
    data: {
      label: 'Data Penilaian',
      svg: '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'
    },
    penugasan: {
      label: 'Penugasan Asesor',
      svg: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    },
    print: {
      label: 'Cetak Laporan',
      svg: '<svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
    }
  };
  const lblElem = document.getElementById('navDropdownLabel');
  const iconElem = document.getElementById('navDropdownIcon');
  if (lblElem && navLabels[tabKey]) lblElem.textContent = navLabels[tabKey].label;
  if (iconElem && navLabels[tabKey]) iconElem.innerHTML = navLabels[tabKey].svg;

  // Otomatis sembunyikan drawer samping kiri jika sedang terbuka di layar HP
  toggleMobileDrawer(false);

  if (tabKey === 'print') {
    renderPrintPreview();
  } else if (tabKey === 'dashboard') {
    updateDynamicDashboard();
  } else if (tabKey === 'data') {
    renderFullTable();
  } else if (tabKey === 'penugasan') {
    renderPenugasanData();
  }
}

/**
 * Memproses URL Hash saat halaman pertama kali dimuat atau saat hash berubah.
 * Memungkinkan tombol yang diklik kanan "Open link in new tab" membuka tab/fitur yang sesuai.
 */
function handleInitialHashRoute() {
  try {
    const rawHash = (window.location.hash || '').replace(/^#/, '').toLowerCase().trim();
    if (!rawHash) {
      try { document.documentElement.removeAttribute('data-initial-tab'); } catch (e) { }
      return;
    }

    if (rawHash === 'dashboard' || rawHash === 'data' || rawHash === 'penugasan' || rawHash === 'print') {
      switchTab(rawHash);
    } else if (rawHash === 'status-all' || rawHash === 'status-belum' || rawHash === 'status-selesai') {
      switchTab('data');
      const filterKey = rawHash.replace('status-', '').toUpperCase();
      const targetBtn = document.querySelector('.filter-btn[href="#' + rawHash + '"]');
      if (typeof setQuickFilter === 'function') {
        setQuickFilter(filterKey, targetBtn);
      }
    } else if (rawHash === 'modal-user') {
      if (typeof openUserModal === 'function') openUserModal();
    } else if (rawHash === 'modal-db-asesor') {
      if (typeof openDbAsesorModal === 'function') openDbAsesorModal();
    } else if (rawHash === 'modal-import') {
      if (typeof openImportModal === 'function') openImportModal();
    } else if (rawHash === 'modal-log') {
      if (typeof openLogModal === 'function') openLogModal();
    } else if (rawHash === 'refresh') {
      if (typeof refreshData === 'function') refreshData(true);
    }
  } catch (err) {
    console.warn('Hash route handling error:', err);
  }
}

/**
 * Helper inisialisasi klik kanan "Open link in new tab" untuk semua tombol
 */
function initOpenInNewTabOnButtons() {
  try {
    if (!window._hashChangeListenerAttached) {
      window.addEventListener('hashchange', function () {
        handleInitialHashRoute();
      });
      window._hashChangeListenerAttached = true;
    }
  } catch (e) {
    // Safe fail
  }
}

/**
 * Counter Animation Helper (Smooth count-up from previous value to new value)
 */
function animateCounter(el, targetVal, duration, suffix) {
  if (!el) return;
  suffix = suffix || '';
  const parsedTarget = parseInt(targetVal, 10);
  const endVal = isNaN(parsedTarget) ? 0 : parsedTarget;
  const currentAttr = el.getAttribute('data-val');
  const startVal = currentAttr !== null ? parseInt(currentAttr, 10) : (parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0);
  el.setAttribute('data-val', endVal);

  if (startVal === endVal) {
    el.textContent = endVal + suffix;
    return;
  }

  duration = duration || 800;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuart formula: 1 - (1 - t)^4
    const ease = 1 - Math.pow(1 - progress, 4);
    const currentVal = Math.round(startVal + (endVal - startVal) * ease);
    el.textContent = currentVal + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = endVal + suffix;
    }
  }

  requestAnimationFrame(update);
}

/**
 * Toast Feedback Helper
 */
function showToast(message, isError) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-card';
  if (isError) toast.style.borderLeft = '4px solid #e11d48';
  else toast.style.borderLeft = '4px solid #059669';

  toast.innerHTML =
    '<svg style="width:18px; height:18px; stroke:currentColor; fill:none; flex-shrink:0;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
    '<span>' + message + '</span>';

  container.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(function () { toast.remove(); }, 300);
  }, 3200);
}
