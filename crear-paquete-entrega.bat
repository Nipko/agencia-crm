@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Crear paquete de entrega Planetour CRM
color 0A

echo =========================================================================
echo               CREANDO PAQUETE SEGURO DE ENTREGA
echo =========================================================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta disponible.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Faltan dependencias. Ejecuta npm ci o instalar-planetour.bat.
    pause
    exit /b 1
)

call npm run lint
if errorlevel 1 (
    echo [ERROR] La validacion de codigo fallo. No se creo el paquete.
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo [ERROR] La compilacion fallo. No se creo el paquete.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Crear-Paquete-Entrega.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
