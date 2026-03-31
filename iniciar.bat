@echo off
echo ========================================
echo  Iniciando GestorPublico
echo ========================================
echo.

echo [1/3] Matando processos antigos...
taskkill /F /IM node.exe /T 2>nul
timeout /t 3 /nobreak >nul

cd /d C:\Users\Usuario\Desktop\public_auditor

echo [2/3] Iniciando API (porta 3001)...
start cmd /k "cd /d C:\Users\Usuario\Desktop\public_auditor\apps\api && pnpm dev"
timeout /t 8 /nobreak >nul

echo [3/3] Iniciando Web (porta 3000)...
start cmd /k "cd /d C:\Users\Usuario\Desktop\public_auditor\apps\web && pnpm dev"

echo.
echo ========================================
echo  Aguarde ~20 segundos...
echo  Depois acesse: http://localhost:3000
echo ========================================
pause
