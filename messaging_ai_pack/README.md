# Pacote de Implementação — RabbitMQ + Evolution API

Este pacote foi preparado especificamente para o projeto **assistente-sulma-main** fornecido pelo usuário. Ele serve como handoff para uma IA de desenvolvimento ou equipe de engenharia implementar a migração do disparo em massa atual para RabbitMQ sem reescrever o CRM.

## Contexto confirmado no código atual

- Aplicação: Next.js 16 / Node.js >= 22.12 / TypeScript.
- ORM: Prisma 7 + PostgreSQL.
- Evolution API já integrada em `src/lib/evolution.ts`.
- O CRM roda **fora de Docker** em produção.
- PostgreSQL roda em Docker atualmente.
- O worker de campanha atual roda dentro do processo do Next.js em `src/lib/campaign-worker.ts`.
- A fila atual é baseada em `CampaignContact` + `FOR UPDATE SKIP LOCKED`.
- `src/lib/anti-block.ts` possui delays e limites que aumentam deliberadamente o tempo entre envios.
- `POST /api/broadcast` chama `prepareCampaignRun()` e, em seguida, inicia o worker em-processo.

## Objetivo

Migrar o envio assíncrono para:

```text
Next.js CRM
   │
   │ cria CampaignRun / CampaignContact
   │ publica job
   ▼
RabbitMQ
   │
   ▼
Sender Worker Node.js (processo separado, PM2/systemd)
   │
   ▼
Evolution API
   │
   ▼
WhatsApp
   │
   └── webhook Evolution ──> Next.js ──> PostgreSQL
```

A migração deve ser incremental. O banco continua sendo a fonte de verdade; RabbitMQ passa a ser o mecanismo de entrega e trabalho assíncrono.

## Ordem recomendada para a IA

1. Ler `CLAUDE.md`.
2. Ler `SPEC.md`.
3. Executar `TASKS.md` em ordem.
4. Consultar os documentos em `docs/` quando a task referenciar uma decisão específica.
5. Aplicar as mudanças no repositório original; este pacote não substitui o código da aplicação.

## Decisão de deployment

O CRM **não será containerizado** nesta fase. Em produção:

- Next.js: processo existente.
- Worker(s) Node: PM2 ou systemd.
- PostgreSQL: Docker, como já ocorre.
- RabbitMQ: Docker.
- Grafana/Prometheus: opcionais inicialmente.

## Resultado esperado da primeira entrega

Ao final da fase MVP:

- `POST /api/broadcast` prepara o run e publica os jobs no RabbitMQ.
- nenhum `sleep()` de campanha mantém o processo Next.js ocupado;
- um worker separado consome a fila e chama a Evolution API;
- ACK só ocorre depois de persistir o resultado;
- falhas transitórias entram em retry com backoff;
- falhas finais vão para DLQ;
- pausar/cancelar run continua funcionando;
- feature flag permite retornar ao worker legado durante a migração.

## Importante sobre limites de envio

Use controles de capacidade, consentimento, opt-out, janela de envio, limites configuráveis e backoff para proteger a infraestrutura e cumprir as regras da plataforma. Não implementar mecanismos destinados a burlar detecção, restrições ou políticas do WhatsApp/Meta.
