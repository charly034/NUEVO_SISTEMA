$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $root 'API_LA_QUINTA'
$adminDir = Join-Path $root 'front_menu'
$clientesDir = Join-Path $root 'front_clientes'
$ports = @(3000, 5174, 5175)

function Get-PidsOnPort {
  param([int]$Port)

  $pattern = "LISTENING"
  netstat -ano |
    Select-String $pattern |
    ForEach-Object {
      $parts = $_.ToString().Trim() -split '\s+'
      if ($parts.Count -lt 5) { return }

      $localAddress = $parts[1]
      $processId = [int]$parts[-1]

      if ($localAddress -match (':' + $Port + '$')) {
        $processId
      }
    } |
    Sort-Object -Unique
}

function Wait-PortClosed {
  param([int]$Port)

  for ($attempt = 1; $attempt -le 10; $attempt++) {
    if (-not (Get-PidsOnPort -Port $Port)) {
      Write-Host "Puerto $Port libre."
      return $true
    }

    Start-Sleep -Seconds 1
  }

  Write-Host "ERROR: el puerto $Port sigue ocupado." -ForegroundColor Red
  return $false
}

function Wait-PortOpen {
  param([int]$Port)

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    if (Get-PidsOnPort -Port $Port) {
      Write-Host "Puerto $Port escuchando."
      return $true
    }

    Start-Sleep -Seconds 1
  }

  Write-Host "ERROR: el puerto $Port no empezo a escuchar a tiempo." -ForegroundColor Red
  return $false
}

function Get-LanIp {
  $line = ipconfig | Select-String 'IPv4' | Select-Object -First 1
  if (-not $line) { return $null }

  ($line.ToString() -split ':')[-1].Trim()
}

Write-Host 'Iniciando La Quinta - Sistema completo...'
Write-Host ''

Write-Host '[0/4] Cerrando servicios previos por puerto...'
foreach ($port in $ports) {
  foreach ($processId in Get-PidsOnPort -Port $port) {
    Write-Host "Cerrando PID $processId que escuchaba en puerto $port"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ''
Write-Host 'Verificando que los puertos quedaron libres...'
foreach ($port in $ports) {
  if (-not (Wait-PortClosed -Port $port)) {
    Write-Host ''
    Write-Host 'No pude dejar libres todos los puertos. Ejecuta detener.bat y volve a intentar.' -ForegroundColor Red
    exit 1
  }
}

Write-Host ''
Write-Host '[1/4] API (puerto 3000)...'
Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory $apiDir -WindowStyle Normal
if (-not (Wait-PortOpen -Port 3000)) {
  Write-Host ''
  Write-Host 'La API no inicio correctamente. Revisa la ventana de la API.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '[2/4] Panel Admin (puerto 5174, LAN habilitada)...'
Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', '0.0.0.0') -WorkingDirectory $adminDir -WindowStyle Normal

Write-Host '[3/4] App Clientes (puerto 5175, LAN habilitada)...'
Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', '0.0.0.0') -WorkingDirectory $clientesDir -WindowStyle Normal

Write-Host ''
Write-Host '[4/4] Verificando frontends...'
if (-not (Wait-PortOpen -Port 5174)) {
  Write-Host ''
  Write-Host 'El panel Admin no inicio correctamente. Revisa su ventana.' -ForegroundColor Red
  exit 1
}

if (-not (Wait-PortOpen -Port 5175)) {
  Write-Host ''
  Write-Host 'La app Clientes no inicio correctamente. Revisa su ventana.' -ForegroundColor Red
  exit 1
}

$lanIp = Get-LanIp

Write-Host ''
Write-Host 'Listo. Servicios levantados:' -ForegroundColor Green
Write-Host '  API:      http://localhost:3000'
Write-Host '  Admin:    http://localhost:5174'
Write-Host '  Clientes: http://localhost:5175'

if ($lanIp) {
  Write-Host ''
  Write-Host 'Desde el celular en la misma red:' -ForegroundColor Yellow
  Write-Host "  Admin:    http://$($lanIp):5174"
  Write-Host "  Clientes: http://$($lanIp):5175"
}

Write-Host ''
Write-Host 'Abriendo paneles locales...'
Start-Process 'http://localhost:5174'
Start-Process 'http://localhost:5175'
