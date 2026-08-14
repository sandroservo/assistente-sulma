# Deploy da Assistente Sulma

## Pré-requisitos no servidor

1. **Node.js** (>= 22.12.0, conforme `package.json`)
2. **PostgreSQL** (database dedicado, ex.: `sulma`)
3. **Nginx** (para proxy e SSL)
4. **Certificado SSL** para o domínio público (Let's Encrypt)

## Primeira vez no servidor

### 1. Clonar o repositório

```bash
mkdir -p /www
cd /www
git clone <URL_DO_REPOSITORIO> sulma
cd sulma
```

### 2. Criar `.env`

```bash
cp .env.example .env
nano .env
```

Preencha pelo menos:

- `DATABASE_URL` – PostgreSQL (pode criar um DB `sulma`)
- **`AUTH_SECRET`** – gere com: `openssl rand -base64 32` (obrigatório para login em produção; o código também aceita `NEXTAUTH_SECRET`)
- **`AUTH_URL=https://seu-dominio.com`** – URL pública do site (obrigatório em produção para o login não redirecionar para localhost; se usar proxy, o código já usa `trustHost: true`)

### 3. Rodar migrações e seed (se necessário)

```bash
npx prisma migrate deploy
npm run build
# Opcional: seed admin/knowledge
# npx tsx scripts/seed-admin.ts
```

### 4. Instalar e ativar o serviço systemd

```bash
sudo cp scripts/sulma-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sulma-app
sudo systemctl start sulma-app
sudo systemctl status sulma-app
```

### 5. Configurar Nginx

- Copie o conteúdo de `scripts/nginx-sulma.conf` para o Nginx (dentro do `http` ou em um arquivo em `conf.d/`).
- Ajuste os caminhos do SSL se precisar.

### 6. Certificado SSL

Antes do HTTPS funcionar, o DNS do domínio deve apontar para o IP do servidor. Depois:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d seu-dominio.com
sudo nginx -t && sudo systemctl reload nginx
```

## Deploy contínuo (a partir da sua máquina)

Na pasta do repositório:

```bash
bash scripts/deploy.sh
```

O script vai:

1. Conectar no servidor
2. Fazer `git pull` em `/www/sulma`
3. `npm ci`, `npm run build`, reiniciar o serviço `sulma-app`

## URLs

- Produção: URL definida em `AUTH_URL`
- Serviço no servidor: `http://127.0.0.1:3001`

## Comandos úteis no servidor

```bash
# Logs da assistente
sudo journalctl -u sulma-app -f

# Reiniciar
sudo systemctl restart sulma-app

# Status
sudo systemctl status sulma-app
curl -I http://127.0.0.1:3001
```
