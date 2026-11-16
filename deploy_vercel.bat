@echo off
title SIM-ASESOR Vercel Deployment Tool
echo ================================================================================
echo       SIM-ASESOR NTT - ALAT PENYAMBUNG & DEPLOY VERCEL VIA TERMINAL
echo ================================================================================
echo.

cd /d "%~dp0"

echo [1/3] Memeriksa kesiapan lingkungan...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [INFORMASI DARI ZETTBOT]
    echo Node.js belum terpasang di komputer Anda.
    echo.
    echo Langkah mudah untuk mengaktifkan Vercel CLI di terminal:
    echo 1. Kunjungi: https://nodejs.org/en/download
    echo 2. Unduh versi LTS (Windows Installer .msi) dan pasang (cukup klik Next).
    echo 3. Setelah selesai, jalankan kembali berkas ini atau ketik 'npx vercel' di terminal.
    echo.
    echo Jika ingin menggunakan Git (karena Git sudah aktif di komputer Anda):
    echo - Jalankan: git add . ; git commit -m "update" ; git push
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js terdeteksi!
echo.
echo [2/3] Memulai koneksi & deployment ke Vercel Production...
echo (Jika baru pertama kali, browser akan terbuka untuk konfirmasi login sekali saja)
echo.
npx vercel --prod

echo.
echo ================================================================================
echo [SELESAI] Deployment berhasil! Tautan website aktif tercantum di atas.
echo ================================================================================
pause
