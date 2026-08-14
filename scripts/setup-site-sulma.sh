#!/bin/bash
# Configura Nginx + SSL para o domínio da Sulma (rodar NO SERVIDOR, uma vez).
# Defina DOMAIN antes de executar, ou edite o valor abaixo.
#
# No servidor:
#   cd /www/sulma
#   sudo DOMAIN=seu-dominio.com bash scripts/setup-site-sulma.sh

set -euo pipefail

DOMAIN="${DOMAIN:-seu-dominio.com}"
NGINX_CONF="/etc/nginx/conf.d/sulma.conf"
SOURCE_CONF="$(dirname "$0")/nginx-sulma.conf"

if [ ! -f "$SOURCE_CONF" ]; then
  echo "Arquivo não encontrado: $SOURCE_CONF"
  echo "Execute a partir de /www/sulma (ou onde está o script)."
  exit 1
fi

echo "=== Configurando site $DOMAIN ==="

echo "Copiando config Nginx para $NGINX_CONF ..."
cp "$SOURCE_CONF" "$NGINX_CONF"

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "Certificado SSL não encontrado."
  echo "Crie o certificado antes (DNS de $DOMAIN deve apontar para este servidor):"
  echo "  sudo mkdir -p /var/www/certbot"
  echo "  sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
  echo ""
  echo "Depois execute este script de novo: sudo bash scripts/setup-site-sulma.sh"
  exit 1
fi

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "✅ Nginx recarregado. Site: https://$DOMAIN"
else
  echo "❌ Erro no config do Nginx. Rode: sudo nginx -t"
  exit 1
fi
