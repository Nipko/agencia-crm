@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Instalador Planetour CRM
color 0A

echo =========================================================================
echo             INSTALACION SEGURA DE PLANETOUR CRM
echo =========================================================================
echo Carpeta: %CD%
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en PATH.
    echo Instala Node.js 20.19+ o 22.12+ y vuelve a ejecutar este archivo.
    pause
    exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm no esta instalado o no se encuentra en PATH.
    pause
    exit /b 1
)

node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit((major===20&&minor>=19)||(major===22&&minor>=12)||major>22?0:1)"
if errorlevel 1 (
    echo [ERROR] La version instalada de Node.js no es compatible.
    echo Requerido: Node.js 20.19+ o 22.12+. Detectado:
    node --version
    pause
    exit /b 1
)

if not exist ".env" (
    if not exist ".env.example" (
        echo [ERROR] No se encontro .env.example.
        pause
        exit /b 1
    )

    copy /Y ".env.example" ".env" >nul
    echo [PENDIENTE] Se creo .env a partir de la plantilla segura.
    echo Completa PGPASSWORD y ADMIN_PASSWORD. Luego guarda el archivo y
    echo vuelve a ejecutar instalar-planetour.bat.
    start "" notepad.exe "%CD%\.env"
    pause
    exit /b 2
)

findstr /C:"replace_with_" ".env" >nul
if not errorlevel 1 (
    echo [ERROR] .env todavia contiene valores de ejemplo.
    echo Configura las claves locales y vuelve a ejecutar el instalador.
    start "" notepad.exe "%CD%\.env"
    pause
    exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$text=Get-Content -LiteralPath '.env' -Raw; $keys=@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','ADMIN_EMAIL','ADMIN_NAME','ADMIN_PASSWORD'); $invalid=@($keys | Where-Object { $text -notmatch ('(?m)^'+[regex]::Escape($_)+'=(?!\s*$).+$') }); if($invalid.Count){ Write-Host ('[ERROR] Variables vacias o ausentes: '+($invalid -join ', ')) -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
    echo Revisa .env y vuelve a ejecutar el instalador.
    pause
    exit /b 2
)

echo [1/3] Instalando dependencias verificadas por package-lock.json...
call npm ci --include=dev
if errorlevel 1 (
    echo [ERROR] No fue posible instalar las dependencias.
    echo Verifica la conexion a Internet, proxy o firewall corporativo.
    pause
    exit /b 1
)

echo.
echo [2/3] Preparando PostgreSQL...
call npm run db:setup
if errorlevel 1 (
    echo [ERROR] No fue posible conectar o inicializar PostgreSQL.
    echo Verifica que PostgreSQL este activo y revisa los valores PG* de .env.
    echo Si la base no existe, PGUSER necesita permiso CREATEDB.
    pause
    exit /b 1
)

echo.
echo [3/3] Compilando la aplicacion optimizada...
call npm run build
if errorlevel 1 (
    echo [ERROR] La compilacion no finalizo correctamente.
    pause
    exit /b 1
)

echo.
choice /C SN /N /M "Instalar Planetour CRM como servicio automatico de Windows? [S/N]: "
if errorlevel 2 goto installation_complete

echo Configurando acceso para los equipos de la red Privada o Dominio...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Servicio-Planetour.ps1" -Action Install -OpenFirewall
if errorlevel 1 (
    echo [ERROR] La aplicacion se instalo, pero no se pudo crear el servicio.
    echo Puedes reintentarlo con instalar-servicio-windows.bat.
    pause
    exit /b 1
)

:installation_complete
echo.
echo =========================================================================
echo        INSTALACION COMPLETADA
echo =========================================================================
echo Aplicacion local: http://localhost:4000
echo Estado API:       http://localhost:4000/api/health
echo Si no instalaste el servicio, usa ejecutar-servidor.bat.
echo Cambia la clave inicial del administrador despues del primer acceso.
echo.
pause
endlocal
