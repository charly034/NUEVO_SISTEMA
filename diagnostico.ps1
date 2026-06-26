$ErrorActionPreference = 'SilentlyContinue'
$puertos = 3000, 5174, 5175
$ok = $true

Write-Host "=== DIAGNOSTICO LA QUINTA ===" -ForegroundColor Cyan

# 1) Perfil de red activo
$perfil = Get-NetConnectionProfile |
  Where-Object { $_.IPv4Connectivity -ne 'Disconnected' } |
  Select-Object -First 1

if (-not $perfil) {
  Write-Host "1) Perfil de red: NO DETECTADO" -ForegroundColor Red
  $ok = $false
}
else {
  Write-Host ("1) Perfil de red: " + $perfil.NetworkCategory + " en " + $perfil.InterfaceAlias)
  if ($perfil.NetworkCategory -ne 'Private') {
    Write-Host "   ERROR: la red no esta en Private." -ForegroundColor Red
    $ok = $false
  }
  else {
    Write-Host "   OK"
  }
}

# 2) Puertos escuchando y bind LAN
$listen = Get-NetTCPConnection -State Listen |
  Where-Object { $puertos -contains $_.LocalPort }

foreach ($p in $puertos) {
  $rows = $listen | Where-Object { $_.LocalPort -eq $p }
  if (-not $rows) {
    Write-Host ("2) Puerto " + $p + ": NO ESCUCHA") -ForegroundColor Red
    $ok = $false
    continue
  }

  $addresses = $rows.LocalAddress | Sort-Object -Unique
  $soloLocalhost = $true
  foreach ($a in $addresses) {
    if ($a -ne '127.0.0.1' -and $a -ne '::1') {
      $soloLocalhost = $false
      break
    }
  }

  if ($soloLocalhost) {
    Write-Host ("2) Puerto " + $p + ": SOLO LOCALHOST (" + ($addresses -join ', ') + ")") -ForegroundColor Red
    Write-Host "   ERROR: inicia Vite con --host 0.0.0.0"
    $ok = $false
  }
  else {
    Write-Host ("2) Puerto " + $p + ": OK (" + ($addresses -join ', ') + ")")
  }
}

# 3) Reglas de firewall por puerto
$allowInbound = Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow
foreach ($p in $puertos) {
  $reglaOK = $false

  foreach ($r in $allowInbound) {
    if ($r.Profile -notmatch 'Private|Any') { continue }

    $filters = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $r
    foreach ($f in $filters) {
      if ($f.Protocol -ne 'TCP') { continue }
      if ($f.LocalPort -eq [string]$p -or $f.LocalPort -eq 'Any') {
        $reglaOK = $true
        break
      }
    }

    if ($reglaOK) { break }
  }

  if ($reglaOK) {
    Write-Host ("3) Firewall puerto " + $p + ": OK")
  }
  else {
    Write-Host ("3) Firewall puerto " + $p + ": SIN REGLA") -ForegroundColor Red
    $ok = $false
  }
}

# 4) IP LAN para probar desde celular
$ip = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '169.254*' -and
    $_.IPAddress -ne '127.0.0.1' -and
    $_.PrefixOrigin -ne 'WellKnown'
  } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
if ($ip) {
  Write-Host "Probar desde celular (misma red):" -ForegroundColor Yellow
  Write-Host ("Admin:    http://" + $ip + ":5174")
  Write-Host ("Clientes: http://" + $ip + ":5175")
}

Write-Host ""
if ($ok) {
  Write-Host "RESULTADO: Todo OK en PC. Si en celular no abre, revisar aislamiento WiFi (AP/Client Isolation o red de invitados)." -ForegroundColor Yellow
}
else {
  Write-Host "RESULTADO: Hay fallas locales marcadas en rojo." -ForegroundColor Red
}
