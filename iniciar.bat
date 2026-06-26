@echo off
echo Iniciando La Quinta - Sistema completo...
echo.

echo [1/3] API (puerto 3000)...
start "API La Quinta" cmd /k "cd /d "%~dp0API_LA_QUINTA" && node src/server.js"

timeout /t 3 /nobreak >nul

echo [2/3] Panel Admin (puerto 5174)...
start "Admin La Quinta" cmd /k "cd /d "%~dp0front_menu" && npm run dev -- --host 0.0.0.0"

echo [3/3] App Clientes (puerto 5175)...
start "Clientes La Quinta" cmd /k "cd /d "%~dp0front_clientes" && npm run dev -- --host 0.0.0.0"

echo.
echo Listo. Abriendo en 5 segundos...
timeout /t 5 /nobreak >nul

start http://localhost:5174
start http://localhost:5175

:: ─────────────────────────────────────────────────────────────────────────────
:: Para reimportar los menús desde el CSV (borra y recrea todo):
::   cd API_LA_QUINTA && node src/database/seeds/seed-menus.js
:: ─────────────────────────────────────────────────────────────────────────────
