@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Estado de Planetour CRM

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Status
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
