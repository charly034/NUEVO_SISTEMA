$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $root 'API_LA_QUINTA'
$adminDir = Join-Path $root 'front_menu'
$clientesDir = Join-Path $root 'front_clientes'
$ports = @(3000, 5174, 5175)

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
foreach ($port in $ports) {
  foreach ($pid in Get-PidsOnPort -Port $port) {
    Write-Host "  Puerto $port -> cerrando PID $pid"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}
foreach ($port in $ports) {
  Wait-PortClosed -Port $port | Out-Null
}

Write-Host ''
Write-Host '[2/2] Iniciando servicios...'
Write-Host ''

$wtCmd = Get-Command wt -ErrorAction SilentlyContinue

if ($wtCmd) {
  $wtArgs = @(
    'new-tab', '--title', 'API :3000',            '-d', $apiDir,      'cmd', '/k', 'npm run dev',
    ';',
    'new-tab', '--title', 'Front Clientes :5175', '-d', $clientesDir, 'cmd', '/k', 'npm run dev',
    ';',
    'new-tab', '--title', 'Front Menu :5174',     '-d', $adminDir,    'cmd', '/k', 'npm run dev',
    ';',
    'new-tab', '--title', 'Tunnel CF',                                'cmd', '/k', 'cloudflared tunnel run'
  )
  & wt @wtArgs
  Write-Host '  4 servicios abriendo en Windows Terminal (una ventana, 4 pestanas).' -ForegroundColor Green
} else {
  Write-Host '  Windows Terminal no encontrado. Abriendo ventanas separadas...' -ForegroundColor Yellow
  Start-Process 'node'        -ArgumentList 'src/server.js' -WorkingDirectory $apiDir
  Start-Process 'npm.cmd'     -ArgumentList 'run', 'dev'   -WorkingDirectory $clientesDir
  Start-Process 'npm.cmd'     -ArgumentList 'run', 'dev'   -WorkingDirectory $adminDir
  Start-Process 'cloudflared' -ArgumentList 'tunnel', 'run'
}

Write-Host ''
Write-Host '  URLs locales:' -ForegroundColor White
Write-Host '    API:      http://localhost:3000'
Write-Host '    Admin:    http://localhost:5174'
Write-Host '    Clientes: http://localhost:5175'
Write-Host ''
Write-Host '  Acceso externo (celular fuera de red):' -ForegroundColor Yellow
Write-Host '    https://dev.laquintacomidas.com' -ForegroundColor Yellow
Write-Host ''
