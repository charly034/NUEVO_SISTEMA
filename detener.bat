@echo off
setlocal

echo Deteniendo servicios de La Quinta...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$targets = Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('node.exe','npm.exe')) -and $_.CommandLine -and ($_.CommandLine -like '*\\API_LA_QUINTA\\*' -or $_.CommandLine -like '*\\front_menu\\*' -or $_.CommandLine -like '*\\front_clientes\\*') }; if(-not $targets){ Write-Host 'No se encontraron procesos node/npm del proyecto por ruta.' } else { $targets | ForEach-Object { Write-Host ('Deteniendo PID ' + $_.ProcessId + ' - ' + $_.Name); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }"

echo.
echo Verificando puertos 3000, 5174, 5175...
for %%P in (3000 5174 5175) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Cerrando PID %%I que escuchaba en puerto %%P
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo.
echo Servicios detenidos.
endlocal
