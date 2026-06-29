@echo off
setlocal

echo Deteniendo servicios de La Quinta...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; function Stop-Tree([int]$ProcessId) { Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId } | ForEach-Object { Stop-Tree $_.ProcessId }; Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue }; $processes = Get-CimInstance Win32_Process; $rootPattern = '*' + $root + '*'; $projectProcessNames = @('node.exe','npm.exe','cmd.exe','wt.exe','cloudflared.exe'); $targets = $processes | Where-Object { ($_.Name -in $projectProcessNames -and $_.CommandLine -and $_.CommandLine -like $rootPattern) -or ($_.Name -eq 'cloudflared.exe') -or ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'cloudflared\s+tunnel\s+run') }; if(-not $targets){ Write-Host 'No se encontraron procesos previos del proyecto.' } else { $targets | ForEach-Object { Write-Host ('Deteniendo PID ' + $_.ProcessId + ' - ' + $_.Name); Stop-Tree $_.ProcessId } }"

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
