@echo off
setlocal

echo Ejecutando diagnostico de red y puertos de La Quinta...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnostico.ps1"

echo.
echo Fin del diagnostico.
pause

endlocal
