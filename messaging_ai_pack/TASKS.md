# TASKS.md — Backlog executável

Execute em ordem. Não pule para multi-instância antes do MVP estar estável.

## EPIC A — Infraestrutura RabbitMQ

### TASK-001 — Adicionar RabbitMQ ao Docker Compose
**Arquivos:** `docker-compose.yml`

- adicionar `rabbitmq:3-management`;
- portas 5672 e 15672;
- volume persistente;
- healthcheck;
- credenciais por ENV, não hardcode em produção.

**Aceite:** Postgres e RabbitMQ sobem; CRM continua rodando fora do Docker.

### TASK-002 — Dependências AMQP

Adicionar `amqplib` e tipos adequados.

**Aceite:** build TypeScript passa.

### TASK-003 — Connection manager

Criar `src/lib/messaging/rabbit.ts` com conexão lazy, channel confirm, reconexão e fechamento gracioso.

**Aceite:** publisher consegue reconectar após restart do broker.

### TASK-004 — Declarar topologia

Criar `src/lib/messaging/topology.ts` conforme `docs/RABBITMQ.md`.

**Aceite:** exchanges/queues/bindings são idempotentemente declarados no boot do publisher/worker.

## EPIC B — Contratos

### TASK-005 — Event schema

Criar `src/lib/messaging/contracts.ts` com Zod.

**Aceite:** job inválido não chega à lógica de envio; vai para invalid/DLQ com log seguro.

### TASK-006 — Campos de rastreabilidade Prisma

Aplicar migration descrita em `prisma/MIGRATION_PROPOSAL.prisma`.

**Aceite:** dados existentes preservados.

## EPIC C — Publisher

### TASK-007 — Campaign job publisher

Criar `src/lib/messaging/campaign-publisher.ts`.

- carregar contatos pending;
- publicar com publisher confirms;
- registrar `queuedAt`, `queueJobId`;
- suportar republish de pending não enfileirado.

**Aceite:** publicar 100 jobs sem iniciar `campaign-worker.ts`.

### TASK-008 — Feature flag

Alterar `src/lib/campaigns.ts` e `src/app/api/broadcast/route.ts`.

- rabbitmq => publish;
- legacy => fluxo existente.

**Aceite:** trocar driver apenas por ENV.

### TASK-009 — Cron repair publisher

Alterar `src/app/api/cron/campaigns/route.ts` para, em modo RabbitMQ, localizar runs RUNNING e garantir que pending sem `queuedAt` sejam publicados.

**Aceite:** crash após criar contatos e antes de publicar é recuperável.

## EPIC D — Worker

### TASK-010 — Entry point do worker

Criar `src/workers/campaign-sender.ts` executável por `tsx`/build Node.

**Aceite:** worker sobe sem Next.js.

### TASK-011 — Consumer com prefetch 1

- `prefetch(1)`;
- valida contrato;
- carrega dados atuais do banco;
- verifica status do run/contato.

**Aceite:** jobs de run PAUSED/CANCELLED não são enviados.

### TASK-012 — Reutilizar Evolution client

Extrair dependências que impeçam `src/lib/evolution.ts` de ser usado pelo worker standalone, se houver.

**Aceite:** envio real funciona fora do processo Next.js.

### TASK-013 — Idempotência

- `queueJobId` único;
- `attemptCount`;
- se status já terminal, ACK sem reenviar;
- lock otimista/transação para mover queued -> processing.

**Aceite:** redelivery do mesmo job não produz segundo envio quando o primeiro já foi persistido.

### TASK-014 — Persistência de sucesso

Persistir contato, providerId, sentAt, contador do run e inbox/mensagem conforme funções atuais (`prepareMassOutbound`, `confirmMassOutbound`) sem duplicação.

**Aceite:** tela atual continua refletindo campanha.

## EPIC E — Retry e DLQ

### TASK-015 — Classificação de erros

Reusar/adaptar `classifySendError` de `src/lib/send-error.ts`.

**Aceite:** 429/5xx/network = transitório; opt-out/invalid = permanente.

### TASK-016 — Retry queues

Implementar 5s, 30s, 2m, 10m com DLX de retorno.

**Aceite:** erro transitório reprocessa e incrementa attemptCount.

### TASK-017 — DLQ

Depois do máximo de tentativas, marcar `failed`, registrar erro sanitizado e publicar em DLQ.

**Aceite:** mensagem pode ser inspecionada sem conter token.

## EPIC F — Pause/Resume/Cancel

### TASK-018 — Compatibilizar endpoints existentes

Adaptar:
- `src/app/api/broadcast/mine/route.ts`
- `src/app/api/broadcast/[runId]/route.ts`
- `src/app/api/broadcast/[runId]/resume/route.ts`

**Aceite:** pause é respeitado pelo worker; resume republica pending elegível; cancel nunca envia job pendente.

## EPIC G — Webhook

### TASK-019 — Correlacionar providerId

Garantir que webhook Evolution atualize `CampaignContact` usando providerId e continue atualizando Message/Conversation como hoje.

**Aceite:** sent -> delivered -> read aparece corretamente.

## EPIC H — Observabilidade

### TASK-020 — Logs JSON

Criar logger estruturado ou padronizar console JSON no MVP.

Campos: `service`, `event`, `correlationId`, `jobId`, `runId`, `contactId`, `instanceId`, `attempt`, `durationMs`.

### TASK-021 — Healthcheck worker

Worker deve expor ou registrar readiness; opcionalmente HTTP localhost `/health`.

### TASK-022 — Métricas mínimas

Counters e gauges descritos em `docs/OBSERVABILITY.md`.

## EPIC I — Deploy

### TASK-023 — PM2

Adicionar ecosystem conforme `infra/ecosystem.config.cjs`.

### TASK-024 — systemd alternativo

Documentar serviço em `docs/DEPLOY.md`.

### TASK-025 — Smoke test e rollout

Executar `docs/TEST_PLAN.md`.

## EPIC J — Desativação do legado

### TASK-026 — Shadow period

Rodar RabbitMQ em produção com grupo pequeno/teste e feature flag.

### TASK-027 — Remover invocações do legacy worker

Somente após critérios de estabilidade.

### TASK-028 — Manter código legado por uma janela de rollback

Não apagar imediatamente.

### TASK-029 — Limpeza final

Depois da janela de rollback, remover `startCampaignWorker()` dos fluxos ativos e documentar ADR final.
