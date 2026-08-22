# Smoke test — mensageria de campanhas via RabbitMQ

Roda **local** antes de produção. Regra de ouro: mantenha `CAMPAIGN_QUEUE_DRIVER=legacy` até tudo aqui passar; só então vire pra `rabbitmq`.

Legenda: 🖥️ terminal · 🌐 navegador · 🐇 RabbitMQ mgmt (http://localhost:15672)

---

## 0. Setup

`.env` (local) — acrescentar:
```
CAMPAIGN_QUEUE_DRIVER=rabbitmq
RABBITMQ_URL=amqp://sulma_app:change-me@127.0.0.1:5672/sulma
RABBITMQ_PREFETCH=1
RABBITMQ_PUBLISH_TIMEOUT_MS=10000
CAMPAIGN_MAX_ATTEMPTS=5
CAMPAIGN_WORKER_NAME=campaign-sender-1
# credenciais do broker (docker-compose)
RABBITMQ_DEFAULT_USER=sulma_app
RABBITMQ_DEFAULT_PASS=change-me
RABBITMQ_DEFAULT_VHOST=sulma
```

🖥️
```bash
docker compose up -d rabbitmq          # sobe o broker (CRM continua fora do Docker)
docker compose ps                      # rabbitmq healthy?
npx prisma migrate deploy              # aplica 20260819150000_add_campaign_queue_fields
npx prisma generate
npm run build                          # confirma que compila
```

## 1. Self-check puro (sem broker/DB)
🖥️
```bash
npx tsx scripts/campaign-queue-check.ts   # Esperado: "OK — campaign-queue self-check passou"
```

## 2. Subir worker + app (2 terminais)
🖥️ terminal A:
```bash
npm run worker:campaign
# Esperado (JSON): {"service":"campaign-sender","event":"ready","queue":"wa.campaign.send.v1",...}
```
🖥️ terminal B:
```bash
npm run dev
```
🐇 confirmar topologia criada: exchanges `wa.campaign.direct`/`wa.campaign.dlx`, filas `wa.campaign.send.v1`, `wa.campaign.retry.{5s,30s,2m,10m}.v1`, `wa.campaign.dead.v1`.

## 3. Disparo controlado
🌐 crie um **modelo** em /campaigns → dispare em **Contatos → Disparo em Massa** com **1–2 números seus** (evita spam real).
- 🖥️ publisher (terminal B): `{"service":"publisher","event":"run_published","published":N}`
- 🐇 mensagens entram em `wa.campaign.send.v1` e somem conforme o worker consome
- 🖥️ worker (terminal A): `{"event":"sent",...}` por contato
- 🌐 painel de campanha mostra sent/entregue/lido evoluindo (webhook casa providerId)

---

## 4. Critérios de aceite (SPEC §12) — cada um é um teste

| # | Como testar | Esperado |
|---|---|---|
| Sem loop no Next | disparar e observar terminal B | nenhum `sleep`/loop de envio no processo Next; só publish |
| Restart do Next não para envio | `Ctrl-C` no `npm run dev` durante o disparo, e volte | worker (terminal A) segue enviando os jobs já publicados |
| Redelivery sem duplicar | mate o worker (`Ctrl-C` A) no meio, suba de novo | jobs voltam, mas contato com `providerId` já salvo é **ack sem reenviar** (`skip_not_claimable`) |
| Retry transitório | force erro de rede (desconecte a instância um instante) | job vai pra `retry.5s` → volta; `attemptCount` sobe; 🐇 vê a retry queue |
| DLQ no fim | deixe falhar 5x (ou erro `blocked`) | contato vira `failed`; mensagem aparece em `wa.campaign.dead.v1` **sem token** |
| Pause | pausar o run no painel enquanto há jobs na fila | worker loga `run_not_running` e não envia; contatos voltam a `pending` |
| Resume | retomar | pending são **republicados** e enviados |
| Cancel | cancelar | jobs restantes na fila são ack sem envio (status já `skipped`) |
| Opt-out | adicionar o número à suppression e disparar | worker marca `skipped`/`opt_out`, não envia |

🐇 métricas mínimas: contadores de `send.v1` (ready/unacked), retry queues e `dead.v1`.

## 5. Idempotência (banco)
🗄️
```bash
psql "$DATABASE_URL" -c 'SELECT status,count(*) FROM "CampaignContact" GROUP BY 1;'
psql "$DATABASE_URL" -c 'SELECT "queueJobId","attemptCount","status" FROM "CampaignContact" WHERE "queueJobId" IS NOT NULL LIMIT 5;'
# queueJobId único por contato; nenhum contato "sent" com 2 envios.
```

## 6. Rollback (instantâneo)
`.env`: `CAMPAIGN_QUEUE_DRIVER=legacy` → reiniciar `npm run dev`, parar o worker.
Volta ao worker in-process. Nada de RabbitMQ é fonte de verdade — o banco decide status.

---

**Passou tudo local?** → produção: broker no host (docker), worker no **PM2** (`pm2 start messaging_ai_pack/infra/ecosystem.config.cjs`) ou systemd, `.env` de prod, e só então virar a flag. Manter `campaign-worker.ts` legado durante a janela de rollback (TASK-028).
