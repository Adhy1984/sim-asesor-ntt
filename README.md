# PANDUAN DEPLOYMENT VERCEL (SKENARIO 1: DECOUPLED HEADLESS)
================================================================================
SIM-ASESOR: Sistem Monitoring & Evaluasi Penilaian Visitasi Akreditasi Asesor
BAN PDM Provinsi NTT
Engine: ZettBOT by Zettbos (Universal Product Architect & Lead Engineering Mentor)
================================================================================

Selamat! Berkas proyek frontend Anda telah siap untuk di-deploy ke Vercel dengan arsitektur **Skenario 1**:
- **Frontend:** Di-hosting di Vercel (Domain bersih, kecepatan kilat, zero iframe, tanpa bug layar putih).
- **Database:** Tetap 100% berada di Google Sheets Anda (`DataPenilaian`, `DataUser`, `DBAsesor`).
- **Backend API:** Menggunakan Google Apps Script (`code.gs`) yang bertindak sebagai REST API JSON.

---

## 🚀 LANGKAH 1: Deploy Ulang Google Apps Script Sebagai REST API (1 Menit)

Agar Google Apps Script dapat dihubungi oleh Vercel, kita perlu memastikan Web App di-deploy dengan akses publik:

1. Buka spreadsheet Google Sheets Anda.
2. Di menu atas, klik **Extensions** (Ekstensi) -> **Apps Script**.
3. Pastikan kode file `code.gs` Anda sudah versi terbaru (yang memiliki fungsi `doPost` dan `handleApiRequest`).
4. Di pojok kanan atas editor Apps Script, klik tombol biru **Deploy** (Terapkan) -> **New deployment** (Penerapan baru).
5. Pada jendela yang muncul:
   - Klik ikon gerigi (Select type) -> pilih **Web app**.
   - **Description:** `SIM-ASESOR API v1.0.51`
   - **Execute as (Jalankan sebagai):** `Me (email-anda@gmail.com)` *(Sangat penting: pilih Me)*
   - **Who has access (Siapa yang memiliki akses):** `Anyone` (Siapa saja) *(Sangat penting: pilih Anyone agar Vercel dapat membaca database)*
6. Klik tombol **Deploy**.
7. Salin (Copy) **Web app URL** yang muncul. URL ini berakhiran `/exec`.
   Contoh format:
   `https://script.google.com/macros/s/AKfycbx_XXXXXXXXXXXXXX_XXXXXXXXXXXX/exec`

---

## ⚙️ LANGKAH 2: Hubungkan URL API ke `vercel/config.js` (30 Detik)

1. Buka berkas [vercel/config.js](file:///c:/Users/ACER/.gemini/antigravity-ide/Projek/vercel/config.js) di teks editor Anda.
2. Ganti tulisan `"PASTE_WEB_APP_EXEC_URL_HERE"` dengan URL yang Anda salin dari Langkah 1.
   Contoh:
   ```javascript
   const CONFIG = {
     GAS_API_URL: "https://script.google.com/macros/s/AKfycbx_XXXXXXXXXXXXXX_XXXXXXXXXXXX/exec",
     APP_NAME: "SIM-ASESOR NTT",
     VERSION: "v1.0.51",
     TIMEOUT_MS: 30000
   };
   ```
3. Simpan berkas `config.js`.

---

## 🌐 LANGKAH 3: Deploy ke Vercel (1 Menit)

Anda memiliki 2 cara mudah untuk deploy ke Vercel:

### Opsi A: Melalui Dashboard Vercel & GitHub (Paling Direkomendasikan)
1. Buat repositori baru di GitHub Anda (misal: `sim-asesor-ntt`).
2. Masukkan isi folder `vercel/` ke repositori tersebut.
3. Buka [https://vercel.com](https://vercel.com) dan login/daftar gratis dengan akun GitHub Anda.
4. Klik tombol **Add New...** -> **Project**.
5. Pilih repositori `sim-asesor-ntt` yang baru Anda buat, lalu klik **Import**.
6. Pada bagian *Build & Development Settings*, biarkan default (karena ini adalah situs web statis murni).
7. Klik **Deploy**!
8. Dalam waktu ~20 detik, website Anda akan langsung aktif dengan link resmi Vercel (misal: `https://sim-asesor-ntt.vercel.app`).

### Opsi B: Menggunakan Vercel CLI Langsung dari Terminal
Jika Anda memiliki Node.js & npm di komputer Anda:
1. Buka terminal di folder `vercel/`:
   ```bash
   cd vercel
   npx vercel
   ```
2. Ikuti instruksi di layar (tekan Enter untuk default).
3. Setelah proses selesai, terminal akan menampilkan URL website Anda yang siap dipakai!

---

## ✅ VERIFIKASI FITUR SETELAH DEPLOY:
1. Buka link Vercel Anda di peramban ponsel (Android/iPhone) dan laptop.
2. Perhatikan:
   - Efek rasi bintang kosmik (*Plexus Constellation*) bergerak mulus di belakang kartu login.
   - Tidak ada lagi bilah/strip putih di bagian bawah layar HP Android!
   - Masuk menggunakan akun admin atau asesor Anda (data diambil langsung dari tab `DataUser`).
   - Ubah status penilaian atau input penugasan -> cek spreadsheet Google Sheets Anda, data akan terupdate secara real-time!
   - Export laporan Excel berformat `.xlsx` dengan tabel lengkap.

(c) Zettbos. All Rights Reserved.
