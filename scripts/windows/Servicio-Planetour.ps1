[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [ValidateSet("Install", "Uninstall", "Status", "Start", "Stop")]
    [string]$Action = "Install",

    [Parameter(Mandatory = $false)]
    [switch]$OpenFirewall,

    [Parameter(Mandatory = $false)]
    [int]$Port = 4000,

    [Parameter(Mandatory = $false)]
    [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"

# Obtain root project path (parent of scripts\windows)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..") | Select-Object -ExpandProperty Path
$EnvFile = Join-Path $ProjectRoot ".env"

function Write-Header {
    param([string]$Title)
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "            $Title" -ForegroundColor Cyan
    Write-Host "=========================================================================" -ForegroundColor Cyan
}

function Get-LocalIPAddress {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue | 
          Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | 
          Select-Object -ExpandProperty IPAddress -First 1
    if (-not $ip) { return "localhost" }
    return $ip
}

function Ensure-EnvFile {
    if (-not (Test-Path $EnvFile)) {
        Set-Content -Path $EnvFile -Value "PORT=4000`nPGHOST=localhost`nPGPORT=5432`nPGUSER=postgres`nPGPASSWORD=pl4n3t0ur`nPGDATABASE=planetour_db`nHOST=0.0.0.0"
    } else {
        $content = Get-Content -Path $EnvFile -Raw
        if ($content -notmatch "HOST=") {
            Add-Content -Path $EnvFile -Value "`nHOST=0.0.0.0"
        }
    }
}

function Check-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

switch ($Action) {
    "Start" {
        Write-Header "INICIANDO SERVICIO PLANETOUR CRM"
        $TaskName = "PlanetourCRMService"
        
        try {
            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Host "[OK] Tarea de servicio '$TaskName' iniciada." -ForegroundColor Green
        } catch {
            Write-Host "[INFO] No se pudo iniciar la tarea '$TaskName'. Ejecutando servidor directamente..." -ForegroundColor Yellow
        }
        
        $LocalIP = Get-LocalIPAddress
        Write-Host "=========================================================================" -ForegroundColor Green
        Write-Host "  Acceso API Backend LAN:  http://${LocalIP}:${Port}" -ForegroundColor White
        Write-Host "  Acceso Web App LAN:      http://${LocalIP}:${WebPort}" -ForegroundColor White
        Write-Host "=========================================================================" -ForegroundColor Green
        exit 0
    }

    "Stop" {
        Write-Header "DETENIENDO SERVICIO PLANETOUR CRM"
        $TaskName = "PlanetourCRMService"
        try {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Host "[OK] Tarea de servicio '$TaskName' detenida." -ForegroundColor Green
        } catch {}
        exit 0
    }

    "Install" {
        Write-Header "INSTALANDO SERVICIO PLANETOUR CRM (LAN & REINICIO AUTOMATICO)"

        if (-not (Check-Admin)) {
            Write-Host "[ADVERTENCIA] Re-iniciando con privilegios de Administrador..." -ForegroundColor Yellow
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action Install -OpenFirewall" -Verb RunAs
            exit 0
        }

        Ensure-EnvFile

        # Configure Firewall if requested
        if ($OpenFirewall) {
            Write-Host "[1/3] Configurando reglas en el Firewall de Windows..." -ForegroundColor Green
            try {
                Remove-NetFirewallRule -DisplayName "Planetour CRM Backend (Port 4000)" -ErrorAction SilentlyContinue
                Remove-NetFirewallRule -DisplayName "Planetour CRM Frontend (Port 5173)" -ErrorAction SilentlyContinue

                New-NetFirewallRule -DisplayName "Planetour CRM Backend (Port 4000)" `
                                    -Direction Inbound `
                                    -Protocol TCP `
                                    -LocalPort $Port `
                                    -Action Allow `
                                    -Profile Any | Out-Null

                New-NetFirewallRule -DisplayName "Planetour CRM Frontend (Port 5173)" `
                                    -Direction Inbound `
                                    -Protocol TCP `
                                    -LocalPort $WebPort `
                                    -Action Allow `
                                    -Profile Any | Out-Null

                Write-Host "[OK] Puertos $Port (API) y $WebPort (Web) habilitados en Firewall." -ForegroundColor Green
            } catch {
                Write-Host "[AVISO] No se pudieron agregar reglas de firewall: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }

        # Create Windows Scheduled Task for Auto-Start on Boot
        Write-Host "[2/3] Creando tarea programada de inicio automatico con Windows..." -ForegroundColor Green
        $TaskName = "PlanetourCRMService"
        
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        } catch {}

        $NodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Path
        if (-not $NodeExe) {
            $NodeExe = "C:\Program Files\nodejs\node.exe"
        }

        $ScriptPath = Join-Path $ProjectRoot "server\index.js"
        $ActionCmd = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$ScriptPath`"" -WorkingDirectory $ProjectRoot
        $TriggerBoot = New-ScheduledTaskTrigger -AtStartup
        $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit 0

        try {
            Register-ScheduledTask -TaskName $TaskName `
                                   -Action $ActionCmd `
                                   -Trigger @($TriggerBoot, $TriggerLogon) `
                                   -Settings $Settings `
                                   -User "SYSTEM" `
                                   -RunLevel Highest | Out-Null

            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Host "[OK] Tarea de servicio '$TaskName' creada e iniciada con exito." -ForegroundColor Green
        } catch {
            Write-Host "[AVISO] Registrando tarea para el usuario actual..." -ForegroundColor Yellow
            Register-ScheduledTask -TaskName $TaskName `
                                   -Action $ActionCmd `
                                   -Trigger @($TriggerBoot, $TriggerLogon) `
                                   -Settings $Settings `
                                   -RunLevel Highest | Out-Null
            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        }

        # Display LAN Access Info
        $LocalIP = Get-LocalIPAddress
        Write-Host "[3/3] Servicio Operativo en Red Local LAN" -ForegroundColor Green
        Write-Host "=========================================================================" -ForegroundColor Green
        Write-Host "  Acceso Backend API LAN:  http://${LocalIP}:${Port}" -ForegroundColor White
        Write-Host "  Acceso Web App LAN:      http://${LocalIP}:${WebPort}" -ForegroundColor White
        Write-Host "  Acceso por Nombre PC:    http://${env:COMPUTERNAME}:${Port}" -ForegroundColor White
        Write-Host "=========================================================================" -ForegroundColor Green
        exit 0
    }

    "Uninstall" {
        Write-Header "DESINSTALANDO SERVICIO PLANETOUR CRM"
        $TaskName = "PlanetourCRMService"

        if (-not (Check-Admin)) {
            Write-Host "Re-iniciando con privilegios de Administrador..." -ForegroundColor Yellow
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action Uninstall" -Verb RunAs
            exit 0
        }

        try {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
            Write-Host "[OK] Tarea programada '$TaskName' desinstalada." -ForegroundColor Green
        } catch {
            Write-Host "[INFO] La tarea '$TaskName' no estaba registrada." -ForegroundColor Gray
        }

        try {
            Remove-NetFirewallRule -DisplayName "Planetour CRM Backend (Port 4000)" -ErrorAction SilentlyContinue
            Remove-NetFirewallRule -DisplayName "Planetour CRM Frontend (Port 5173)" -ErrorAction SilentlyContinue
            Write-Host "[OK] Reglas de firewall removidas." -ForegroundColor Green
        } catch {}

        exit 0
    }

    "Status" {
        Write-Header "ESTADO DEL SERVICIO PLANETOUR CRM"
        $TaskName = "PlanetourCRMService"
        
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) {
            $info = Get-ScheduledTaskInfo -TaskName $TaskName
            Write-Host "  Servicio Windows:        REGISTRADO ($($task.State))" -ForegroundColor Green
            Write-Host "  Ultimo inicio:           $($info.LastRunTime)" -ForegroundColor White
            Write-Host "  Resultado ejecucion:     $($info.LastTaskResult)" -ForegroundColor White
        } else {
            Write-Host "  Servicio Windows:        NO REGISTRADO" -ForegroundColor Yellow
        }

        $LocalIP = Get-LocalIPAddress
        Write-Host "  Direccion IP Local LAN:  $LocalIP" -ForegroundColor Cyan
        Write-Host "  Puerto API Backend:      $Port" -ForegroundColor Cyan
        Write-Host "  Puerto Web App:          $WebPort" -ForegroundColor Cyan
        exit 0
    }
}
