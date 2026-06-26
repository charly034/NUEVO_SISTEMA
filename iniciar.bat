@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-servicios.ps1"

endlocal
