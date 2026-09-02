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
