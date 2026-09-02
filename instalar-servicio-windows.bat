@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Instalar servicio Planetour CRM
color 0A

if not exist "scripts\windows\Servicio-Planetour.ps1" (
    echo [ERROR] Falta scripts\windows\Servicio-Planetour.ps1.
    pause
    exit /b 1
)

echo Se habilitara el acceso para los equipos de la red Privada o Dominio.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Install -OpenFirewall
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%

