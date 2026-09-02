@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Habilitar Ping ICMP y Puertos LAN Planetour CRM
color 0A

echo =========================================================================
echo       CONFIGURAR PING ICMP Y PUERTOS LAN EN SERVIDOR WINDOWS 11
echo =========================================================================
echo Servidor objetivo: 192.168.1.86
echo Este proceso habilita Ping ICMPv4 y abre los puertos 4000 y 5173 en Windows Firewall.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "^
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent();^
    $principal = New-Object Security.Principal.WindowsPrincipal($identity);^
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {^
        Write-Host '[ERROR] Ejecuta este archivo haciendo clic derecho -> Ejecutar como Administrador.' -ForegroundColor Red;^
        exit 1;^
    }^
    Write-Host '[1/3] Habilitando respuesta a PING (ICMPv4 Echo Request)...' -ForegroundColor Green;^
    Remove-NetFirewallRule -DisplayName 'Permitir Ping ICMPv4 Planetour' -ErrorAction SilentlyContinue;^
    New-NetFirewallRule -DisplayName 'Permitir Ping ICMPv4 Planetour' -Protocol ICMPv4 -IcmpType 8 -Enabled True -Direction Inbound -Action Allow -Profile Any | Out-Null;^
    Write-Host '[OK] Ping ICMPv4 habilitado.' -ForegroundColor Green;^
    Write-Host '[2/3] Cambiando perfil de red a Privada...' -ForegroundColor Green;^
    Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue;^
    Write-Host '[OK] Red configurada como Privada.' -ForegroundColor Green;^
    Write-Host '[3/3] Abriendo puertos 4000 (API) y 5173 (Web UI)...' -ForegroundColor Green;^
    Remove-NetFirewallRule -DisplayName 'Planetour CRM API 4000' -ErrorAction SilentlyContinue;^
    Remove-NetFirewallRule -DisplayName 'Planetour CRM Web 5173' -ErrorAction SilentlyContinue;^
    New-NetFirewallRule -DisplayName 'Planetour CRM API 4000' -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Any | Out-Null;^
    New-NetFirewallRule -DisplayName 'Planetour CRM Web 5173' -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Any | Out-Null;^
    Write-Host '[OK] Puertos 4000 y 5173 abiertos para cualquier perfil de red.' -ForegroundColor Green;^
    Write-Host '=========================================================================' -ForegroundColor Cyan;^
    Write-Host 'Servidor configurado. Prueba ahora: ping 192.168.1.86' -ForegroundColor White;^
    Write-Host 'Y en el navegador: http://192.168.1.86:5173' -ForegroundColor White;^
    Write-Host '=========================================================================' -ForegroundColor Cyan;^
"

echo.
pause
