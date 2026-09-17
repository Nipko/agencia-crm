@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Actualizador Planetour CRM
color 0B

echo =========================================================================
echo                  ACTUALIZACION DE PLANETOUR CRM
echo =========================================================================
echo Carpeta del proyecto: %CD%
echo.

:: 1. Validar Git
where git.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git no esta instalado o no se encuentra en el PATH del sistema.
    echo Instala Git para Windows o actualiza el codigo manualmente.
    pause
    exit /b 1
)

:: 2. Validar Node.js
where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en PATH.
    pause
    exit /b 1
)

:: 3. Validar npm
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm no esta instalado o no se encuentra en PATH.
    pause
    exit /b 1
)

:: 4. Validar .env (sin modificarlo ni alterarlo)
if not exist ".env" (
    echo [ERROR] No se encontro el archivo .env en el servidor.
    echo Asegurate de que la configuracion del servidor este presente antes de actualizar.
    pause
    exit /b 1
)

echo [1/5] Deteniendo servidor en ejecucion para actualizar archivos de forma segura...
schtasks.exe /Query /TN "PlanetourCRMService" >nul 2>nul
if not errorlevel 1 (
    schtasks.exe /End /TN "PlanetourCRMService" >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":4000 .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

set REPO_URL=https://github.com/Nipko/agencia-crm.git
set BRANCH=main

echo.
echo [2/5] Verificando repositorio y descargando ultimos cambios...
if not exist ".git" (
    echo [INFO] No se detecto configuracion Git en esta carpeta.
    echo Conectando automaticamente con %REPO_URL% ...
    git init
    if errorlevel 1 (
        echo [ERROR] No fue posible inicializar Git.
        pause
        exit /b 1
    )
    git remote add origin %REPO_URL%
    git fetch origin %BRANCH%
    if errorlevel 1 (
        echo [ERROR] No fue posible descargar del repositorio %REPO_URL%.
        echo Verifica la conexion a Internet.
        pause
        exit /b 1
    )
    git branch -M %BRANCH%
    git reset --hard origin/%BRANCH%
    git branch --set-upstream-to=origin/%BRANCH% %BRANCH%
) else (
    git remote get-url origin >nul 2>nul
    if errorlevel 1 (
        echo [INFO] Configurando origen remoto: %REPO_URL% ...
        git remote add origin %REPO_URL%
    )
    git fetch origin %BRANCH%
    if errorlevel 1 (
        echo [ERROR] No fue posible conectar con el repositorio remoto.
        echo Verifica la conexion a Internet o los permisos de Git.
        pause
        exit /b 1
    )
    git reset --hard origin/%BRANCH%
)
if errorlevel 1 (
    echo [ERROR] Hubo un error al actualizar los archivos con Git.
    pause
    exit /b 1
)
echo [OK] Codigo actualizado correctamente a la ultima version de %BRANCH%.

echo.
echo [3/5] Actualizando dependencias del proyecto...
call npm install
if errorlevel 1 (
    echo [ERROR] No fue posible actualizar las dependencias de Node.js.
    pause
    exit /b 1
)

echo.
echo [4/5] Aplicando actualizaciones de base de datos PostgreSQL...
call npm run db:setup
if errorlevel 1 (
    echo [ERROR] No se pudieron aplicar los cambios en la base de datos PostgreSQL.
    echo Verifica que el servicio de PostgreSQL este activo y que .env sea correcto.
    pause
    exit /b 1
)

echo.
echo [5/5] Compilando la aplicacion frontend para produccion...
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion de la aplicacion con Vite.
    pause
    exit /b 1
)

echo.
echo Reiniciando el servidor Planetour CRM...
schtasks.exe /Query /TN "PlanetourCRMService" >nul 2>nul
if not errorlevel 1 (
    echo Iniciando tarea programada PlanetourCRMService...
    schtasks.exe /Run /TN "PlanetourCRMService" >nul 2>nul
    echo Servicio reiniciado exitosamente.
) else (
    echo Puedes iniciar el servidor ejecutando: ejecutar-servidor.bat
)

echo.
echo =========================================================================
echo                 ACTUALIZACION COMPLETADA CON EXITO
echo =========================================================================
git log -1 --pretty=format:"Ultimo commit aplicado: %h - %s (%cd)"
echo.
echo.
echo  - Aplicacion local: http://localhost:4000
echo  - Estado de la API: http://localhost:4000/api/health
echo =========================================================================
echo.
pause
endlocal
