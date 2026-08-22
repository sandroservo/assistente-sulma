# Evolução do banco

## Princípio

Não substituir `CampaignRun`/`CampaignContact`. Estender.

## Campos propostos em CampaignContact

- `queueJobId String? @unique`
- `queuedAt DateTime?`
- `processingAt DateTime?`
- `attemptCount Int @default(0)`
- `lastAttemptAt DateTime?`
- `notBefore DateTime?`
- `lastQueueError String? @db.Text`

Opcional futuro:
- `instanceId String?`

## Estados

Manter compatibilidade com strings atuais:

`pending -> queued -> processing -> sent -> delivered -> read`

Terminais alternativos:

`failed`, `skipped`.

Durante rollout, telas que esperam `sending` devem aceitar `queued` e `processing`, ou mapear ambos para “enviando”.

## Índices

- `(runId, status)`
- `(status, notBefore)`
- unique `queueJobId`
- providerId já indexado.

## Contadores CampaignRun

Atualizar `sent/failed/skipped` por transação junto à transição terminal do contato. Evitar incrementar novamente em redelivery verificando estado anterior.

## Outbox

Não implementar no MVP. O repair publisher resolve a janela DB->RabbitMQ. Se o projeto passar a exigir garantias transacionais estritas ou múltiplos eventos de domínio, introduzir tabela `OutboxEvent` em ADR separado.
