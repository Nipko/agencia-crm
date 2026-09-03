# PowerShell Script para habilitar PING ICMPv4 y abrir puertos 4000/5173 en Windows Firewall
$ErrorActionPreference = "Continue"

function Check-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "      CONFIGURAR PING ICMP Y PUERTOS LAN EN SERVIDOR WINDOWS 11" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Check-Admin)) {
    Write-Host "[ADVERTENCIA] No estás ejecutando como Administrador." -ForegroundColor Yellow
    Write-Host "Por favor haz clic derecho sobre habilitar-ping-y-red.bat -> 'Ejecutar como Administrador'." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[1/3] Habilitando respuesta a PING (ICMPv4 Echo Request)..." -ForegroundColor Green
try {
    Remove-NetFirewallRule -DisplayName "Permitir Ping ICMPv4 Planetour" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Permitir Ping ICMPv4 Planetour" -Protocol ICMPv4 -IcmpType 8 -Enabled True -Direction Inbound -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[OK] Regla de PING ICMPv4 configurada." -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Requiere ejecutar como Administrador para modificar reglas de Firewall." -ForegroundColor Yellow
}

Write-Host "[2/3] Configurando perfil de red como Privada..." -ForegroundColor Green
try {
    Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue
    Write-Host "[OK] Perfil de red verificado." -ForegroundColor Green
} catch {
    Write-Host "[AVISO] No se pudo cambiar el perfil de red." -ForegroundColor Yellow
}

Write-Host "[3/3] Abriendo puertos 4000 (API) y 5173 (Web UI)..." -ForegroundColor Green
try {
    Remove-NetFirewallRule -DisplayName "Planetour CRM API 4000" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Planetour CRM Web 5173" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Planetour CRM API 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
    New-NetFirewallRule -DisplayName "Planetour CRM Web 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[OK] Puertos 4000 y 5173 configurados en Firewall." -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Requiere ejecutar como Administrador para abrir puertos." -ForegroundColor Yellow
}

$ip = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue | 
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | 
      Select-Object -ExpandProperty IPAddress -First 1
if (-not $ip) { $ip = "192.168.1.86" }

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host " Configuracion Procesada. Prueba ahora desde tu red local:" -ForegroundColor White
Write-Host "  1. Ping al servidor:        ping $ip" -ForegroundColor White
Write-Host "  2. Acceso Web App LAN:      http://${ip}:5173" -ForegroundColor White
Write-Host "  3. Acceso API Backend LAN:  http://${ip}:4000" -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
