#!/bin/bash
# Deploy só da Assistente Sulma.
# Não mexe no Manager (porta 5000) nem no EduRH (porta 3001).
# Uso: bash scripts/deploy.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_USER="root"
SERVER_IP="148.230.74.96"
SERVER_PORT="22"
SERVER_DIR="/srv/sulma"
SERVICE_NAME="sulma-app"
PORT="3002"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}"
echo "=========================================="
echo "  Assistente Sulma - Deploy"
echo "  Destino: ${SERVER_DIR}  porta ${PORT}"
echo "=========================================="
echo -e "${NC}"

if [ ! -f "$REPO_ROOT/package.json" ] || [ ! -f "$REPO_ROOT/next.config.ts" ]; then
  echo -e "${RED}❌ Execute a partir da pasta do repositório sulma.${NC}"
  exit 1
fi

if ! ssh -p "$SERVER_PORT" -o BatchMode=yes -o ConnectTimeout=8 "${SERVER_USER}@${SERVER_IP}" "echo OK" >/dev/null 2>&1; then
  echo -e "${RED}❌ Não foi possível conectar ao servidor ${SERVER_IP}.${NC}"
  exit 1
fi

if [ -n "$(cd "$REPO_ROOT" && git status --porcelain --untracked-files=no)" ]; then
  echo -e "${RED}❌ Há alterações não commitadas. Faça commit antes do deploy.${NC}"
  git status --short
  exit 1
fi

echo -e "${YELLOW}📤 Enviando código para ${SERVER_DIR} (sem .env, sem systemd)...${NC}"

rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'data/' \
  --exclude 'devops/' \
  -e "ssh -p $SERVER_PORT" \
  "$REPO_ROOT/" \
  "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/"

ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" bash -s <<EOSSH
set -e
SERVER_DIR="$SERVER_DIR"
SERVICE_NAME="$SERVICE_NAME"
PORT="$PORT"

cd "\$SERVER_DIR"

if [ ! -f .env ]; then
  echo "❌ .env não encontrado em \$SERVER_DIR. Abortando para não quebrar a produção."
  exit 1
fi

if [ ! -f "/etc/systemd/system/\$SERVICE_NAME.service" ]; then
  echo "❌ Serviço \$SERVICE_NAME não existe. Não instalo unidade nova para não conflitar com EduRH/Manager."
  exit 1
fi

echo "📦 npm ci..."
npm ci || npm install

echo "🗃️  prisma db push..."
npx prisma db push

echo "🔨 build..."
npm run build

echo "🔄 restart \$SERVICE_NAME (somente Sulma)..."
systemctl restart "\$SERVICE_NAME"

sleep 4
if curl -sf "http://127.0.0.1:\$PORT" >/dev/null 2>&1; then
  echo "✅ Sulma respondendo em http://127.0.0.1:\$PORT"
else
  echo "⚠️  Sulma não respondeu na \$PORT. Logs:"
  journalctl -u "\$SERVICE_NAME" -n 40 --no-pager || true
  exit 1
fi

echo "🔎 Conferindo as outras apps..."
systemctl is-active manager-api.service
docker inspect -f '{{.State.Status}}' edurh
curl -sf -o /dev/null -w "manager-api 5000: %{http_code}\n" http://127.0.0.1:5000/ || true
curl -sf -o /dev/null -w "edurh 3001: %{http_code}\n" http://127.0.0.1:3001/ || true
EOSSH

echo -e "${GREEN}"
echo "=========================================="
echo "  Deploy da Sulma concluído"
echo "=========================================="
echo -e "${NC}"
echo "URL: https://assistente.unisulma.edu.br"
echo ""
