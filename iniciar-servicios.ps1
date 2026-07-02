$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $root 'API_LA_QUINTA'
$adminDir = Join-Path $root 'front_menu'
$clientesDir = Join-Path $root 'front_clientes'
$ports = @(3000, 5174, 5175)

function Stop-ProcessTree {
  param([int]$ProcessId)
  $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-PreviousProjectProcesses {
  $processes = Get-CimInstance Win32_Process
  $rootPattern = '*' + $root + '*'
  $currentPid = $PID
  $processById = @{}
  foreach ($process in $processes) {
    $processById[[int]$process.ProcessId] = $process
  }

  $protectedIds = @{}
  $cursor = $currentPid
  while ($cursor -and $processById.ContainsKey([int]$cursor)) {
    $protectedIds[[int]$cursor] = $true
    $cursor = $processById[[int]$cursor].ParentProcessId
  }

  $projectProcessNames = @('node.exe', 'npm.exe', 'cmd.exe', 'cloudflared.exe')
  $targets = $processes | Where-Object {
    if ($protectedIds.ContainsKey([int]$_.ProcessId) -or $_.ParentProcessId -eq $currentPid) { return $false }
    ($_.Name -in $projectProcessNames -and $_.CommandLine -and $_.CommandLine -like $rootPattern) -or
    ($_.Name -eq 'cloudflared.exe') -or
    ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'title\s+(API :3000|Clientes :5175|Admin :5174|Cloudflare Tunnel)') -or
    ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'cloudflared\s+tunnel\s+run')
  }

  foreach ($target in $targets) {
    Write-Host "  Cerrando proceso previo PID $($target.ProcessId) ($($target.Name))"
    Stop-ProcessTree -ProcessId $target.ProcessId
  }
}

function Get-PidsOnPort {
  param([int]$Port)
  netstat -ano |
    Select-String 'LISTENING' |
    ForEach-Object {
      $parts = $_.ToString().Trim() -split '\s+'
      if ($parts.Count -lt 5) { return }
      $localAddress = $parts[1]
      $processId = [int]$parts[-1]
      if ($localAddress -match (':' + $Port + '$')) { $processId }
    } |
    Sort-Object -Unique
}

function Wait-PortClosed {
  param([int]$Port)
  for ($i = 1; $i -le 10; $i++) {
    if (-not (Get-PidsOnPort -Port $Port)) { return $true }
    Start-Sleep -Seconds 1
  }
  Write-Host "  ERROR: el puerto $Port sigue ocupado." -ForegroundColor Red
  return $false
}

Write-Host ''
Write-Host '  La Quinta - Iniciando sistema completo' -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/2] Cerrando servicios previos...'
Stop-PreviousProjectProcesses
foreach ($port in $ports) {
  foreach ($processId in Get-PidsOnPort -Port $port) {
    Write-Host "  Puerto $port -> cerrando PID $processId"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}
foreach ($port in $ports) {
  Wait-PortClosed -Port $port | Out-Null
}

Write-Host ''
Write-Host '[2/2] Iniciando servicios...'
Write-Host ''

$wtCmd = Get-Command wt.exe -ErrorAction SilentlyContinue

if ($wtCmd) {
  $wtArgs = @(
    '-w', 'La Quinta Servicios',
    'new-tab', '--title', 'API :3000', '-d', $apiDir, 'cmd', '/k', 'title API :3000 && npm run dev',
    ';',
    'new-tab', '--title', 'Clientes :5175', '-d', $clientesDir, 'cmd', '/k', 'title Clientes :5175 && npm run dev -- --force',
    ';',
    'new-tab', '--title', 'Admin :5174', '-d', $adminDir, 'cmd', '/k', 'title Admin :5174 && npm run dev -- --force',
    ';',
    'new-tab', '--title', 'Cloudflare Tunnel', '-d', $root, 'cmd', '/k', 'title Cloudflare Tunnel && cloudflared tunnel run'
  )
  & $wtCmd.Source @wtArgs
  Write-Host '  4 servicios iniciados en una sola ventana de Windows Terminal.' -ForegroundColor Green
  Write-Host '  Pestanas: API, Clientes, Admin y Cloudflare Tunnel.' -ForegroundColor Green
} else {
  Write-Host '  Windows Terminal no encontrado. Abriendo ventanas separadas...' -ForegroundColor Yellow
  Start-Process 'cmd.exe' -ArgumentList '/k', 'npm run dev' -WorkingDirectory $apiDir
  Start-Process 'cmd.exe' -ArgumentList '/k', 'npm run dev -- --force' -WorkingDirectory $clientesDir
  Start-Process 'cmd.exe' -ArgumentList '/k', 'npm run dev -- --force' -WorkingDirectory $adminDir
  Start-Process 'cmd.exe' -ArgumentList '/k', 'cloudflared tunnel run' -WorkingDirectory $root
  Write-Host '  4 servicios iniciados en ventanas visibles de consola.' -ForegroundColor Green
}

Write-Host ''
Write-Host '  URLs locales:' -ForegroundColor White
Write-Host '    API:      http://127.0.0.1:3000'
Write-Host '    Admin:    http://127.0.0.1:5174'
Write-Host '    Clientes: http://127.0.0.1:5175'
Write-Host ''
Write-Host '  Acceso externo (celular fuera de red):' -ForegroundColor Yellow
Write-Host '    https://dev.laquintacomidas.com' -ForegroundColor Yellow
Write-Host '    https://devadmin.laquintacomidas.com' -ForegroundColor Yellow
Write-Host ''
