@echo off
setlocal

echo Cerrando reglas de firewall de La Quinta...
echo.

netsh advfirewall firewall delete rule name="LaQuinta API 3000"
netsh advfirewall firewall delete rule name="LaQuinta Admin 5174"
netsh advfirewall firewall delete rule name="LaQuinta Clientes 5175"

echo.
echo Reglas eliminadas.
pause

endlocal
