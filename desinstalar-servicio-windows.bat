@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Desinstalar servicio Planetour CRM
color 0C

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Uninstall
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%

