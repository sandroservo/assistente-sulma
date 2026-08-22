# Workers

## campaign-sender

### Boot
1. carregar ENV;
2. validar DATABASE_URL/RABBITMQ_URL;
3. conectar Postgres/Prisma;
4. conectar RabbitMQ;
5. assert topology;
6. prefetch(1);
7. consume.

### Handler

Pseudo-fluxo:

```text
validate(job)
load contact + run + campaign
if contact terminal -> ACK
if run != RUNNING -> requeue/ACK according to state
if suppressed -> mark skipped -> ACK
claim queued/pending -> processing transactionally
select eligible connected instance
if not eligible now -> set notBefore -> retry
check WhatsApp number only if policy requires and cache strategy permits
prepare outbound inbox state
call Evolution
persist providerId + sent state + counters
ACK
```

### Shutdown
SIGTERM/SIGINT:
- stop accepting new deliveries;
- wait current handler bounded timeout;
- close channel/connection;
- disconnect Prisma.

## publisher-repair

Pode inicialmente ser uma função chamada pelo cron existente, não um daemon.

Seleciona `CampaignContact` pending de runs RUNNING onde `queuedAt IS NULL` e publica novamente com confirm.

## Concurrency

MVP: 1 worker, prefetch 1.

Se depois houver múltiplas instâncias, não subir N workers consumindo a mesma fila sem controlar instância, pois isso pode gerar concorrência inesperada para a mesma conexão WhatsApp.
