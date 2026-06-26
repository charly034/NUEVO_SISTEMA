@echo off
echo Reiniciando La Quinta...
echo.

call "%~dp0detener.bat"
timeout /t 2 /nobreak >nul
call "%~dp0iniciar.bat"
