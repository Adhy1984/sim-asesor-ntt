/**
 * ================================================================================
 * SIM-ASESOR | Konfigurasi Frontend Vercel (Skenario 1 - Decoupled Headless)
 * ================================================================================
 * Panduan Penggunaan:
 * 1. Buka spreadsheet Google Sheets Anda -> Extensions -> Apps Script.
 * 2. Klik Deploy -> New Deployment -> Pilih tipe 'Web App'.
 * 3. Set 'Execute as' = 'Me' dan 'Who has access' = 'Anyone'.
 * 4. Salin URL Web App yang berakhiran /exec, lalu tempelkan di bawah ini.
 * ================================================================================
 */

const CONFIG = {
  // Masukkan URL Exec Web App Google Apps Script Anda di sini:
  GAS_API_URL: "PASTE_WEB_APP_EXEC_URL_HERE",
  
  // Pengaturan default aplikasi
  APP_NAME: "SIM-ASESOR NTT",
  VERSION: "v1.0.51",
  TIMEOUT_MS: 30000
};
