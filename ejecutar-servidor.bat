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

sc.exe query PlanetourCRM >nul 2>nul
if not errorlevel 1 (
    echo Se encontro el servicio de Windows Planetour CRM.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Start
    if errorlevel 1 (
        echo [ERROR] No fue posible iniciar o comprobar el servicio.
        pause
        exit /b 1
    )
    echo Aplicacion: http://localhost:4000
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
