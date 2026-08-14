#!/bin/bash
# Deploy da Assistente Sulma para o servidor
# Domínio: seu-dominio.com
# Uso: a partir da pasta sulma: bash scripts/deploy.sh
# Ou da raiz do repo: bash sulma/scripts/deploy.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_USER="root"
SERVER_IP="24.144.95.220"
SERVER_PORT="22"
SERVER_DIR="/www/sulma"
APP_SUBDIR=""
SERVICE_NAME="sulma-app"
PORT="3001"
REPO_URL="https://github.com/sandroservo/sulma.git"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSISTENTE_DIR="$REPO_ROOT"

echo -e "${BLUE}"
echo "=========================================="
echo "  Assistente Sulma - Deploy"
echo "=========================================="
echo -e "${NC}"

if [ ! -f "$ASSISTENTE_DIR/package.json" ] || [ ! -f "$ASSISTENTE_DIR/next.config.ts" ]; then
  echo -e "${RED}❌ Execute a partir da pasta do repositório sulma.${NC}"
  exit 1
fi

# Verificar git e SSH
if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}❌ git não encontrado.${NC}"
  exit 1
fi
if ! ssh -p "$SERVER_PORT" -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_IP}" "echo OK" >/dev/null 2>&1; then
  echo -e "${RED}❌ Não foi possível conectar ao servidor ${SERVER_IP}.${NC}"
  exit 1
fi

# Verificar alterações não commitadas (na raiz do repo)
if [ -d "$REPO_ROOT/.git" ]; then
  if [ -n "$(cd "$REPO_ROOT" && git status --porcelain --untracked-files=no)" ]; then
    echo -e "${RED}❌ Há alterações não commitadas no repositório. Faça commit ou stash antes do deploy.${NC}"
    cd "$REPO_ROOT" && git status --short
    exit 1
  fi
fi

echo -e "${YELLOW}📤 Enviando código e fazendo deploy no servidor...${NC}"

ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" bash -s <<EOSSH
set -e
SERVER_DIR="$SERVER_DIR"
REPO_URL="$REPO_URL"
APP_SUBDIR="$APP_SUBDIR"
SERVICE_NAME="$SERVICE_NAME"
PORT="$PORT"

# Se o diretório não existir: criar pai e clonar
if [ ! -d "\$SERVER_DIR" ]; then
  echo "📥 Primeira vez: clonando repositório em \$SERVER_DIR..."
  mkdir -p "\$(dirname "\$SERVER_DIR")"
  git clone "\$REPO_URL" "\$SERVER_DIR"
fi

cd "\$SERVER_DIR" || exit 1

# Se existir mas não for repo git: init + fetch (ex.: pasta criada manualmente)
if [ ! -d .git ]; then
  echo "📥 Inicializando repositório em \$SERVER_DIR..."
  git init
  git remote add origin "\$REPO_URL"
  git fetch origin
  git branch -M main
  git reset --hard origin/main
fi

if [ -n "\$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  git stash push -m "Deploy assistente \$(date +%Y%m%d_%H%M%S)" || true
fi
git fetch --all
git pull origin main || true

# App na raiz do clone (sulma repo) ou em subpasta sulma (monorepo)
if [ -f "\$SERVER_DIR/package.json" ] && [ -f "\$SERVER_DIR/next.config.ts" ]; then
  APP_DIR="\$SERVER_DIR"
else
  APP_DIR="\$SERVER_DIR/\$APP_SUBDIR"
fi
cd "\$APP_DIR" || exit 1

# .env: usar symlink do .env pai (monorepo) ou criar a partir do example
if [ ! -f .env ]; then
  if [ -f "\$SERVER_DIR/.env" ] && [ "\$APP_DIR" != "\$SERVER_DIR" ]; then
    ln -sf "\$SERVER_DIR/.env" .env
    echo "🔗 .env vinculado a \$SERVER_DIR/.env"
  elif [ -f .env.example ]; then
    cp .env.example .env
    echo "⚠️  .env criado a partir de .env.example. Edite no servidor: nano \$APP_DIR/.env"
  fi
fi

# Serviço systemd: instalar se não existir (primeira vez)
if [ ! -f "/etc/systemd/system/\$SERVICE_NAME.service" ] && [ -f "\$APP_DIR/scripts/sulma-app.service" ]; then
  echo "📋 Instalando serviço systemd \$SERVICE_NAME..."
  sudo cp "\$APP_DIR/scripts/sulma-app.service" "/etc/systemd/system/\$SERVICE_NAME.service"
  sudo systemctl daemon-reload
  sudo systemctl enable "\$SERVICE_NAME"
fi

echo "📦 Instalando dependências (incl. dev para build)..."
npm ci || npm install

echo "🗃️  Sincronizando banco de dados (prisma db push)..."
npx prisma db push --accept-data-loss || echo "⚠️  prisma db push falhou, verifique DATABASE_URL no .env"

echo "🔨 Build..."
npm run build

echo "🔄 Reiniciando serviço $SERVICE_NAME..."
sudo systemctl restart $SERVICE_NAME || true

sleep 3
if curl -sf "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
  echo "✅ Assistente respondendo em http://127.0.0.1:$PORT"
else
  echo "⚠️  Verifique: sudo journalctl -u $SERVICE_NAME -n 50"
fi
EOSSH

echo -e "${GREEN}"
echo "=========================================="
echo "  Deploy concluído"
echo "=========================================="
echo -e "${NC}"
echo "URL: https://seu-dominio.com"
echo ""
echo -e "${YELLOW}Se o site não abrir:${NC} no servidor configure Nginx + SSL (uma vez):"
echo "  ssh ${SERVER_USER}@${SERVER_IP}"
echo "  cd $SERVER_DIR && sudo bash scripts/setup-site-sulma.sh"
echo "  (Antes: DNS seu-dominio.com → ${SERVER_IP} e certificado: certbot --webroot -w /var/www/certbot -d seu-dominio.com)"
echo ""
