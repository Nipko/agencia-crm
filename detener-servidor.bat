@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Detener Servidor Planetour CRM
color 0C

echo =========================================================================
echo                  DETENIENDO SERVIDOR PLANETOUR CRM
echo =========================================================================
echo.

schtasks.exe /Query /TN "PlanetourCRMService" >nul 2>nul
if not errorlevel 1 (
    echo Deteniendo tarea de servicio Windows...
    schtasks.exe /End /TN "PlanetourCRMService" >nul 2>nul
)

echo Buscando procesos activos en el puerto 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":4000 .*LISTENING"') do (
    echo Deteniendo proceso Node PID: %%a...
    taskkill /f /pid %%a >nul 2>nul
)

echo.
echo =========================================================================
echo [OK] El servidor Planetour CRM ha sido detenido correctamente.
echo =========================================================================
echo.
pause
