@echo off
echo ========================================
echo  Iniciando GestorPublico
echo ========================================
echo.

cd /d C:\Users\Usuario\Desktop\public_auditor

echo [1/2] Rodando migration do banco de dados...
call pnpm --filter api migrate
echo.

echo [2/2] Iniciando servidores (API + Web)...
echo.
echo Abrindo dois terminais separados...
start cmd /k "cd /d C:\Users\Usuario\Desktop\public_auditor && echo === API - porta 3001 === && pnpm --filter api dev"
timeout /t 3 /nobreak >nul
start cmd /k "cd /d C:\Users\Usuario\Desktop\public_auditor && echo === WEB - porta 3000 === && pnpm --filter web dev"

echo.
echo ========================================
echo  Aguarde os servidores iniciarem...
echo  Depois acesse: http://localhost:3000
echo ========================================
pause
