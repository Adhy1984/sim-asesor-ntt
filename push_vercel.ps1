# SIM-ASESOR NTT - Auto Push ke GitHub & Vercel
$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "       SIM-ASESOR NTT - AUTO PUSH KE VERCEL (ANTIGRAVITY IDE)                   " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

$VercelDir = Join-Path $PSScriptRoot ""
Set-Location $VercelDir

Write-Host "`n[1/3] Memeriksa status berkas di folder vercel..." -ForegroundColor Yellow
$status = git status --porcelain

if (-not $status) {
    Write-Host "[INFO] Tidak ada perubahan berkas. Repositori Vercel sudah versi paling baru!" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    exit 0
}

Write-Host "[2/3] Menyimpan perubahan (commit)..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git add .
git commit -m "Update via Antigravity IDE [$timestamp]"

Write-Host "`n[3/3] Mengirim perubahan ke GitHub & Vercel (git push)..." -ForegroundColor Yellow
git push

Write-Host "`n================================================================================" -ForegroundColor Green
Write-Host "[SUKSES] Berhasil dikirim ke GitHub & Vercel!" -ForegroundColor Green
Write-Host "Vercel otomatis mendeteksi dan memperbarui website live Anda dalam ~15-30 detik." -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
