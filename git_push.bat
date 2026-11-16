@echo off
title SIM-ASESOR GitHub & Vercel Auto-Push Tool
echo ================================================================================
echo       SIM-ASESOR NTT - ALAT PUSH GITHUB KE VERCEL OTOMATIS
echo ================================================================================
echo.

cd /d "%~dp0"

echo Memeriksa status perubahan berkas...
git status -s
echo.

set /p pesanCommit="Ketik catatan perubahan (atau langsung tekan Enter): "
if "%pesanCommit%"=="" set pesanCommit=Update SIM-ASESOR v1.1.04

echo.
echo [1/3] Menyiapkan berkas...
git add .

echo [2/3] Menyimpan catatan perubahan...
git commit -m "%pesanCommit%"

echo [3/3] Mengirim perubahan ke GitHub...
git push

echo.
echo ================================================================================
echo [SUKSES] Berhasil dikirim! Vercel otomatis memperbarui website dalam ~15 detik.
echo ================================================================================
pause
