# check-rules.ps1 — Verificación de reglas generales de MedScale
# Correr antes de pushear: .\check-rules.ps1

$ErrorActionPreference = "Stop"
$found = $false

Write-Host "`n=== Verificando reglas generales ===" -ForegroundColor Cyan

# Regla 1: await en createServiceClient (siempre es bug — la función es síncrona)
Write-Host "`n[1] Buscando 'await createServiceClient'..." -ForegroundColor Yellow
$bug1 = Get-ChildItem -Path "app","lib","components" -Recurse -Include *.ts,*.tsx -File |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  Select-String -Pattern "await\s+createServiceClient"
if ($bug1) {
  $found = $true
  Write-Host "  PROBLEMA: createServiceClient es sincrono, no usar await:" -ForegroundColor Red
  $bug1 | ForEach-Object { Write-Host "    $($_.Path):$($_.LineNumber)" -ForegroundColor Red }
} else {
  Write-Host "  OK - ninguno" -ForegroundColor Green
}

# Regla 2: cliente hardcodeado en codigo (un cliente metido en logica general)
Write-Host "`n[2] Buscando identificadores de cliente hardcodeados..." -ForegroundColor Yellow
$bug2 = Get-ChildItem -Path "app","lib","components" -Recurse -Include *.ts,*.tsx -File |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  Select-String -Pattern "ferttes|bariatric|lopera|4270c9b0|f9ca61f7|883367a9" |
  Where-Object { $_.Line -notmatch "^\s*//|^\s*\*" }
if ($bug2) {
  $found = $true
  Write-Host "  REVISAR: posible cliente hardcodeado en logica general:" -ForegroundColor Red
  $bug2 | ForEach-Object { Write-Host "    $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Red }
} else {
  Write-Host "  OK - ninguno" -ForegroundColor Green
}

# Regla 3: queries a tablas de negocio - listado para revision manual de filtro org
Write-Host "`n[3] Queries a tablas de negocio (revisar que filtren por organization_id)..." -ForegroundColor Yellow
Write-Host "  (informativo - revisa que cada una tenga su filtro de cliente)" -ForegroundColor DarkGray
$q = Get-ChildItem -Path "app\api","lib" -Recurse -Include *.ts -File |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  Select-String -Pattern "\.from\('(leads|appointments|doctors|schedules|messages|lead_procedures)'\)"
$q | ForEach-Object { Write-Host "    $($_.Path):$($_.LineNumber)" -ForegroundColor DarkGray }

Write-Host ""
if ($found) {
  Write-Host "=== HAY PROBLEMAS QUE REVISAR (ver arriba en rojo) ===" -ForegroundColor Red
  exit 1
} else {
  Write-Host "=== Reglas criticas OK ===" -ForegroundColor Green
  exit 0
}
