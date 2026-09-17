#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================================="
echo "                  ACTUALIZACION DE PLANETOUR CRM (LINUX)"
echo "========================================================================="
echo "Directorio: $SCRIPT_DIR"
echo ""

# 1. Validaciones de comandos requeridos
for cmd in git node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "[ERROR] $cmd no esta instalado o no se encuentra en el PATH."
        exit 1
    fi
done

# 2. Validar que .env exista sin modificarlo
if [ ! -f ".env" ]; then
    echo "[ERROR] No se encontro el archivo .env en el servidor."
    echo "Verifica que la configuracion del servidor este presente antes de actualizar."
    exit 1
fi

echo "[1/5] Deteniendo servicio si esta activo..."
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet planetour-crm.service 2>/dev/null; then
    sudo systemctl stop planetour-crm.service || true
elif command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "planetour-crm"; then
    pm2 stop planetour-crm || true
fi

REPO_URL="https://github.com/Nipko/agencia-crm.git"
BRANCH="main"

echo ""
echo "[2/5] Verificando repositorio y descargando ultimos cambios..."
if [ ! -d ".git" ]; then
    echo "[INFO] No se encontro la carpeta .git en esta instalacion."
    echo "Vinculando con repositorio oficial: $REPO_URL..."
    git init
    git remote add origin "$REPO_URL"
    git fetch origin "$BRANCH"
    git branch -M "$BRANCH"
    git reset --hard "origin/$BRANCH"
    git branch --set-upstream-to="origin/$BRANCH" "$BRANCH"
else
    if ! git remote get-url origin >/dev/null 2>&1; then
        echo "[INFO] Configurando origen remoto: $REPO_URL..."
        git remote add origin "$REPO_URL"
    fi
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
fi

echo ""
echo "[3/5] Actualizando dependencias de Node.js..."
if ! npm ci --include=dev; then
    echo "[AVISO] npm ci fallo, ejecutando npm install..."
    npm install
fi

echo ""
echo "[4/5] Aplicando actualizaciones de esquema en PostgreSQL..."
npm run db:setup

echo ""
echo "[5/5] Compilando aplicacion para produccion con Vite..."
npm run build

echo ""
echo "Reiniciando el servicio..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "planetour-crm.service"; then
    sudo systemctl restart planetour-crm.service
    echo "[OK] Servicio systemd 'planetour-crm.service' reiniciado."
elif command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "planetour-crm"; then
    pm2 restart planetour-crm
    echo "[OK] Proceso PM2 'planetour-crm' reiniciado."
else
    echo "[INFO] No se detecto un servicio systemd o PM2 configurado."
    echo "Puedes ejecutar el servidor en segundo plano con: npm run server"
fi

echo ""
echo "========================================================================="
echo "               ACTUALIZACION COMPLETADA CON EXITO"
echo "========================================================================="
git log -1 --pretty=format:"Ultimo commit aplicado: %h - %s (%cd)"
echo ""
echo "  - Estado de la API: http://localhost:4000/api/health"
echo "========================================================================="
