# Plano de migração do código atual

## Alterações exatas

### `docker-compose.yml`
Adicionar RabbitMQ. Não alterar serviço `db` fora do necessário.

### `package.json`
Adicionar dependências AMQP/Zod (Zod se ainda não existir) e script worker.

Exemplo:
```json
{
  "scripts": {
    "worker:campaign": "tsx src/workers/campaign-sender.ts"
  }
}
```

### `src/lib/campaigns.ts`
Hoje importa e chama `startCampaignWorker()`.

Novo comportamento:

```text
prepareCampaignRun() continua igual em essência
runCampaign()/executeCampaignRun():
  if legacy -> startCampaignWorker()
  if rabbitmq -> publishPendingCampaignContacts(runId)
```

Evitar publisher dentro de uma transação Prisma que ainda não commitou.

### `src/app/api/broadcast/route.ts`
Após `prepareCampaignRun`, chamar abstraction `dispatchCampaignRun(runId)` em vez de conhecer worker diretamente.

### `src/lib/campaign-worker.ts`
Manter durante rollout. Não importar no caminho RabbitMQ.

### `src/lib/anti-block.ts`
Separar responsabilidades:

- permanecer com regras de capacidade/eligibilidade que sejam legítimas;
- remover necessidade de `sleep` do novo worker;
- expor cálculo `nextEligibleAt`/`waitMs`;
- worker converte espera em retry/notBefore.

### `src/lib/evolution.ts`
Reutilizar. Verificar se dependências importadas funcionam em entry point standalone. Preservar timeouts.

### `src/app/api/cron/campaigns/route.ts`
Em modo RabbitMQ, não iniciar worker in-process. Executar repair publisher e scheduling.

### Pause/resume
Endpoints existentes devem operar apenas no banco. Resume deve garantir publicação dos pending não enfileirados.

## Ordem de commits recomendada

1. infra + connection + topology;
2. schema + contracts;
3. publisher sem ativar;
4. worker sem ativar;
5. feature flag;
6. retry/DLQ;
7. pause/resume;
8. observabilidade;
9. rollout;
10. legado off.
