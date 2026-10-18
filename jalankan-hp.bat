@echo off
chcp 65001 >nul
title SMB Dharmakirti - Server uji coba HP
echo ============================================================
echo  Server uji coba untuk HP (alamat HTTPS, kamera bisa dipakai)
echo ============================================================
echo.
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared belum terpasang. Pasang sekali dengan perintah ini:
  echo   winget install --id Cloudflare.cloudflared
  echo Lalu tutup jendela ini dan jalankan lagi file ini.
  echo.
  pause
  exit /b 1
)
echo [1/2] Menyalakan server di jendela baru...
start "SMB server" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 >nul
echo [2/2] Membuat alamat HTTPS. Cari baris yang berisi https://....trycloudflare.com
echo       lalu buka alamat itu di HP (data HP atau WiFi boleh).
echo       Tutup jendela ini untuk menghentikan alamat tersebut.
echo.
cloudflared tunnel --url http://localhost:3000
pause
