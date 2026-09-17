[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$Branch = "main",

    [Parameter(Mandatory = $false)]
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..") | Select-Object -ExpandProperty Path
$EnvFile = Join-Path $ProjectRoot ".env"

Set-Location -LiteralPath $ProjectRoot

function Write-Header {
    param([string]$Title)
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "            $Title" -ForegroundColor Cyan
    Write-Host "=========================================================================" -ForegroundColor Cyan
}

Write-Header "ACTUALIZACION DE PLANETOUR CRM (WINDOWS 11)"
Write-Host "Carpeta del proyecto: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# 1. Validar Git
if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git no esta instalado o no se encuentra en el PATH del sistema." -ForegroundColor Red
    exit 1
}

# 2. Validar Node.js
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no esta instalado o no se encuentra en el PATH del sistema." -ForegroundColor Red
    exit 1
}

# 3. Validar npm
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm no esta instalado o no se encuentra en el PATH del sistema." -ForegroundColor Red
    exit 1
}

# 4. Validar .env (sin modificarlo)
if (-not (Test-Path $EnvFile)) {
    Write-Host "[ERROR] No se encontro el archivo .env en $EnvFile." -ForegroundColor Red
    Write-Host "La configuracion del servidor debe existir antes de actualizar." -ForegroundColor Yellow
    exit 1
}

# 5. Detener el servicio activo para evitar bloqueo de archivos (EBUSY en Windows)
Write-Host "[1/5] Deteniendo servidor para liberar archivos bloqueados..." -ForegroundColor Green
$TaskName = "PlanetourCRMService"
try {
    schtasks.exe /Query /TN $TaskName 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deteniendo tarea programada '$TaskName'..." -ForegroundColor Gray
        schtasks.exe /End /TN $TaskName 2>$null | Out-Null
    }
} catch {}

# Matar procesos en puerto 4000
try {
    $connections = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "Terminando proceso Node PID $procId en puerto 4000..." -ForegroundColor Gray
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {}

Start-Sleep -Seconds 1

$RepoUrl = "https://github.com/Nipko/agencia-crm.git"

# 6. Descargar últimos cambios con Git
Write-Host ""
Write-Host "[2/5] Verificando repositorio y descargando ultimos cambios de '$Branch'..." -ForegroundColor Green

if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    Write-Host "[INFO] No se encontro la carpeta .git en esta instalacion." -ForegroundColor Yellow
    Write-Host "Vinculando automaticamente con $RepoUrl..." -ForegroundColor Cyan
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] No fue posible inicializar Git." -ForegroundColor Red
        exit 1
    }
    git remote add origin $RepoUrl
    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] No fue posible conectar con el repositorio $RepoUrl." -ForegroundColor Red
        exit 1
    }
    git branch -M $Branch
    git reset --hard "origin/$Branch"
    git branch --set-upstream-to="origin/$Branch" $Branch
} else {
    try {
        $origin = git remote get-url origin 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($origin)) {
            Write-Host "[INFO] Configurando origen remoto: $RepoUrl..." -ForegroundColor Yellow
            git remote add origin $RepoUrl
        }
    } catch {
        git remote add origin $RepoUrl
    }

    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] No fue posible conectar con el repositorio remoto '$RepoUrl'." -ForegroundColor Red
        exit 1
    }
    git reset --hard "origin/$Branch"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Hubo un error al sincronizar con Git." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Codigo sincronizado con la ultima version de '$Branch'." -ForegroundColor Green

# 7. Actualizar dependencias
Write-Host ""
Write-Host "[3/5] Actualizando dependencias con npm..." -ForegroundColor Green
& npm.cmd install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No fue posible instalar las dependencias." -ForegroundColor Red
    exit 1
}

# 8. Actualizar base de datos PostgreSQL
Write-Host ""
Write-Host "[4/5] Aplicando esquema de base de datos PostgreSQL..." -ForegroundColor Green
& npm.cmd run db:setup
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No fue posible ejecutar 'npm run db:setup'." -ForegroundColor Red
    Write-Host "Verifica que PostgreSQL este activo y que las variables en .env sean correctas." -ForegroundColor Yellow
    exit 1
}

# 9. Compilar la aplicación
Write-Host ""
Write-Host "[5/5] Compilando frontend para produccion con Vite..." -ForegroundColor Green
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] La compilacion con Vite fallo." -ForegroundColor Red
    exit 1
}

# 10. Reiniciar servicio
if (-not $NoRestart) {
    Write-Host ""
    Write-Host "Reiniciando el servicio de Planetour CRM..." -ForegroundColor Green
    try {
        schtasks.exe /Query /TN $TaskName 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            schtasks.exe /Run /TN $TaskName 2>$null | Out-Null
            Write-Host "[OK] Tarea '$TaskName' iniciada exitosamente." -ForegroundColor Green
        } else {
            Write-Host "[INFO] No hay tarea de servicio registrada. Puedes iniciarlo con ejecutar-servidor.bat." -ForegroundColor Yellow
        }
    } catch {}
}

# 11. Resumen final
Write-Host ""
Write-Header "ACTUALIZACION COMPLETADA EXITOSAMENTE"
$lastCommit = git log -1 --pretty=format:"%h - %s (%cd)"
Write-Host "Ultimo commit aplicado: $lastCommit" -ForegroundColor Green
Write-Host ""
Write-Host "  - Acceso Local: http://localhost:4000" -ForegroundColor White
Write-Host "  - Estado API:   http://localhost:4000/api/health" -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
