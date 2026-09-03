@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Habilitar Ping ICMP y Puertos LAN Planetour CRM
color 0A

if not exist "scripts\windows" mkdir "scripts\windows"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Habilitar-Ping-Y-Red.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
