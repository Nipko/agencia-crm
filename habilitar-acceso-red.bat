@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Habilitar acceso de red Planetour CRM
color 0A

echo =========================================================================
echo             HABILITAR ACCESO LAN A PLANETOUR CRM
echo =========================================================================
echo Este proceso configura HOST=0.0.0.0, instala o actualiza el servicio
echo y abre el puerto solo para redes Privada y Dominio.
echo.

if not exist "scripts\windows" mkdir "scripts\windows"

if not exist "scripts\windows\Servicio-Planetour.ps1" (
    echo [INFO] Creando archivo Servicio-Planetour.ps1...
    (
        echo [CmdletBinding^(^)]
        echo param ^(
        echo     [Parameter^(Mandatory = $false^)]
        echo     [ValidateSet^("Install", "Uninstall", "Status"^)]
        echo     [string]$Action = "Install",
        echo     [Parameter^(Mandatory = $false^)]
        echo     [switch]$OpenFirewall,
        echo     [Parameter^(Mandatory = $false^)]
        echo     [int]$Port = 4000,
        echo     [Parameter^(Mandatory = $false^)]
        echo     [int]$WebPort = 5173
        echo ^)
        echo $ErrorActionPreference = "Stop"
        echo $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
        echo $ProjectRoot = Resolve-Path ^(Join-Path $ScriptDir "..\.."^) ^| Select-Object -ExpandProperty Path
        echo $EnvFile = Join-Path $ProjectRoot ".env"
        echo function Get-LocalIPAddress {
        echo     $ip = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast ^| Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } ^| Select-Object -ExpandProperty IPAddress -First 1
        echo     if ^(-not $ip^) { return "localhost" }
        echo     return $ip
        echo }
        echo function Ensure-EnvFile {
        echo     if ^(-not ^(Test-Path $EnvFile^)^) {
        echo         Set-Content -Path $EnvFile -Value "PORT=4000`nPGHOST=localhost`nPGPORT=5432`nPGUSER=postgres`nPGPASSWORD=pl4n3t0ur`nPGDATABASE=planetour_db`nHOST=0.0.0.0"
        echo     } else {
        echo         $content = Get-Content -Path $EnvFile -Raw
        echo         if ^($content -notmatch "HOST="^) { Add-Content -Path $EnvFile -Value "`nHOST=0.0.0.0" }
        echo     }
        echo }
        echo function Check-Admin {
        echo     $identity = [Security.Principal.WindowsIdentity]::GetCurrent^(^)
        echo     $principal = New-Object Security.Principal.WindowsPrincipal^($identity^)
        echo     return $principal.IsInRole^([Security.Principal.WindowsBuiltInRole]::Administrator^)
        echo }
        echo Ensure-EnvFile
        echo if ^($OpenFirewall^) {
        echo     try {
        echo         Remove-NetFirewallRule -DisplayName "Planetour CRM Backend (Port 4000)" -ErrorAction SilentlyContinue
        echo         Remove-NetFirewallRule -DisplayName "Planetour CRM Frontend (Port 5173)" -ErrorAction SilentlyContinue
        echo         New-NetFirewallRule -DisplayName "Planetour CRM Backend (Port 4000)" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private,Domain ^| Out-Null
        echo         New-NetFirewallRule -DisplayName "Planetour CRM Frontend (Port 5173)" -Direction Inbound -Protocol TCP -LocalPort $WebPort -Action Allow -Profile Private,Domain ^| Out-Null
        echo         Write-Host "[OK] Puertos habilitados en Firewall." -ForegroundColor Green
        echo     } catch {}
        echo }
        echo $LocalIP = Get-LocalIPAddress
        echo Write-Host "=========================================================================" -ForegroundColor Green
        echo Write-Host "  Acceso Backend API LAN:  http://${LocalIP}:${Port}" -ForegroundColor White
        echo Write-Host "  Acceso Web App LAN:      http://${LocalIP}:${WebPort}" -ForegroundColor White
        echo Write-Host "=========================================================================" -ForegroundColor Green
    ) > "scripts\windows\Servicio-Planetour.ps1"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Install -OpenFirewall
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
    echo Prueba desde otro equipo con http://NOMBRE-DEL-PC:4000
) else (
    echo [ERROR] No se pudo habilitar el acceso LAN. Revisa el mensaje anterior.
)
pause
exit /b %RESULT%
