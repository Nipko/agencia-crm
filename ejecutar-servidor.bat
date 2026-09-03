@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Planetour CRM
color 0B

echo =========================================================================
echo                    INICIANDO PLANETOUR CRM
echo =========================================================================
echo Carpeta: %CD%
echo.

if not exist "scripts\windows" mkdir "scripts\windows"

if not exist "scripts\windows\Servicio-Planetour.ps1" (
    echo [INFO] Creando controlador Servicio-Planetour.ps1...
    (
        echo [CmdletBinding^(^)]
        echo param ^(
        echo     [Parameter^(Mandatory = $false^)]
        echo     [ValidateSet^("Install", "Uninstall", "Status", "Start", "Stop"^)]
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
        echo     $ip = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } ^| Select-Object -ExpandProperty IPAddress -First 1
        echo     if ^(-not $ip^) { return "localhost" }
        echo     return $ip
        echo }
        echo switch ^($Action^) {
        echo     "Start" {
        echo         $TaskName = "PlanetourCRMService"
        echo         try { Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
        echo         $LocalIP = Get-LocalIPAddress
        echo         Write-Host "Acceso API Backend LAN: http://${LocalIP}:${Port}"
        echo         Write-Host "Acceso Web App LAN:     http://${LocalIP}:${WebPort}"
        echo         exit 0
        echo     }
        echo }
    ) > "scripts\windows\Servicio-Planetour.ps1"
)

schtasks.exe /Query /TN "PlanetourCRMService" >nul 2>nul
if not errorlevel 1 (
    echo Se encontro la tarea de servicio Planetour CRM.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Start
    echo Aplicacion disponible en la red local.
    pause
    exit /b 0
)

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en PATH.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERROR] Falta el archivo .env. Ejecuta instalar-planetour.bat primero.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Faltan las dependencias. Ejecuta instalar-planetour.bat primero.
    pause
    exit /b 1
)

if not exist "dist\index.html" (
    echo No existe una compilacion de produccion. Compilando...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] No fue posible compilar la aplicacion.
        pause
        exit /b 1
    )
)

echo Aplicacion: http://localhost:4000
echo Estado API: http://localhost:4000/api/health
echo Presiona Ctrl+C para detener el servidor.
echo.

call npm run server
if errorlevel 1 (
    echo.
    echo [ERROR] El servidor se detuvo. Revisa PostgreSQL y la configuracion .env.
    pause
    exit /b 1
)

endlocal
