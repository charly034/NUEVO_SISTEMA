@echo off
setlocal

echo Abriendo puertos de La Quinta en firewall (perfil Private)...
echo.

netsh advfirewall firewall add rule name="LaQuinta API 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
netsh advfirewall firewall add rule name="LaQuinta Admin 5174" dir=in action=allow protocol=TCP localport=5174 profile=private
netsh advfirewall firewall add rule name="LaQuinta Clientes 5175" dir=in action=allow protocol=TCP localport=5175 profile=private

echo.
echo Reglas creadas (si no hubo errores).
echo Recomendado: ejecutar diagnostico.bat para confirmar.
pause

endlocal
