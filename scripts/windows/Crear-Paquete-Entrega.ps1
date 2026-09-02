# Script de empaquetado seguro para distribucion en servidor Windows 11
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..") | Select-Object -ExpandProperty Path
$EntregaDir = Join-Path $ProjectRoot "entrega"
$ZipFile = Join-Path $EntregaDir "planetour-crm-windows.zip"
$ShaFile = Join-Path $EntregaDir "planetour-crm-windows.sha256.txt"

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "         CREANDO PAQUETE ZIP SEGURO PARA SERVIDOR WINDOWS" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan

if (-not (Test-Path $EntregaDir)) {
    New-Item -ItemType Directory -Path $EntregaDir | Out-Null
}

if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

$Exclude = @("*.git*", "*entrega*", "*.tmp", "*.log")

Write-Host "[1/2] Comprimiendo archivos del proyecto en $ZipFile..." -ForegroundColor Green
Compress-Archive -Path "$ProjectRoot\*" -DestinationPath $ZipFile -Force

Write-Host "[2/2] Generando checksum SHA256 de verificacion de integridad..." -ForegroundColor Green
$hash = Get-FileHash -Path $ZipFile -Algorithm SHA256
Set-Content -Path $ShaFile -Value "$($hash.Hash)  planetour-crm-windows.zip"

Write-Host "=========================================================================" -ForegroundColor Green
Write-Host " ¡PAQUETE DE ENTREGA GENERADO CON EXITO!" -ForegroundColor Green
Write-Host " Archivo ZIP: $ZipFile" -ForegroundColor White
Write-Host " Hash SHA256: $($hash.Hash)" -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Green
