# CLAUDE.md — Regras de implementação

## Missão

Evoluir o projeto existente para mensageria baseada em RabbitMQ, preservando comportamento funcional e banco atual, com migração incremental e rollback simples.

## Regras obrigatórias

1. **Não reescrever o CRM.** Alterar somente os pontos necessários.
2. PostgreSQL continua como **fonte de verdade** para estado de campanha e mensagens.
3. RabbitMQ é transporte e coordenação de trabalho; não é banco de estado.
4. O Next.js não deve manter loop, `sleep()` ou worker de campanha em produção depois da migração.
5. Não alterar a integração Evolution de forma incompatível; preferir reutilizar `src/lib/evolution.ts`.
6. Consumidores devem ser idempotentes.
7. ACK RabbitMQ somente depois de persistir o estado final correspondente ao processamento.
8. Mensagens devem ser publicadas como `persistent` em filas duráveis.
9. Usar publisher confirms.
10. Retry deve ter limite explícito e DLQ.
11. Não registrar token Evolution, senha, API key ou payload sensível em logs.
12. Configuração por ENV.
13. Workers não dependem de estado em memória para correção.
14. Um job deve possuir `eventId`/`jobId`, `runId`, `campaignContactId`, `organizationId` e `correlationId`.
15. O worker deve revalidar o status do `CampaignRun` antes de enviar.
16. O worker deve revalidar suppression/opt-out antes de enviar.
17. Implementar feature flag `CAMPAIGN_QUEUE_DRIVER=legacy|rabbitmq` durante migração.
18. Não remover `campaign-worker.ts` até a conclusão dos testes de produção e rollback.
19. Não introduzir Redis no MVP sem necessidade demonstrada.
20. Não criar uma fila RabbitMQ por contato/usuário. O particionamento é por instância quando necessário.

## Qualidade

- TypeScript `strict` compatível com o projeto.
- Funções pequenas e testáveis.
- Erros classificados em permanente/transitório.
- Logs estruturados com IDs de correlação.
- Testes unitários para contratos, retry e idempotência.
- Testes de integração para RabbitMQ + Postgres.

## Definition of Done

Uma task só termina quando:

- código compila;
- lint passa;
- happy path e falha principal foram testados;
- não há segredo hardcoded;
- logs possuem `correlationId`, `runId`, `contactId` quando aplicável;
- documentação afetada foi atualizada;
- rollback não foi quebrado.

## Arquivos atuais que exigem atenção

- `src/lib/campaign-worker.ts` — worker legado/in-process.
- `src/lib/campaigns.ts` — hoje chama `startCampaignWorker()`.
- `src/app/api/broadcast/route.ts` — dispara o processamento.
- `src/app/api/cron/campaigns/route.ts` — inicia worker legado.
- `src/app/api/broadcast/mine/route.ts` — pause/resume/worker.
- `src/app/api/broadcast/[runId]/route.ts` — status/worker.
- `src/lib/anti-block.ts` — limites/delays atuais; deve ser transformado em política de capacidade explícita.
- `src/lib/evolution.ts` — cliente de envio a reutilizar.
- `src/app/api/webhooks/evolution/route.ts` — atualização de status.
- `prisma/schema.prisma` — estado da campanha e campos de idempotência/rastreabilidade.
- `docker-compose.yml` — adicionar RabbitMQ sem containerizar o CRM.
