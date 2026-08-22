# Deploy

## Produção alvo

```text
Host aplicação
├─ Next.js CRM (já existente)
├─ PM2
│  └─ campaign-sender
└─ Docker
   ├─ postgres
   └─ rabbitmq
```

Evolution permanece no servidor separado atual.

## Docker

Usar `infra/docker-compose.infrastructure.yml` como referência para adicionar RabbitMQ ao compose atual.

Não mover o CRM para Docker nesta fase.

## PM2

Exemplo em `infra/ecosystem.config.cjs`.

Comandos esperados depois que script existir no package.json:

```bash
npm run build
pm2 start infra/ecosystem.config.cjs
pm2 save
```

Ideal: compilar entry point do worker para JS ou usar `tsx` sob PM2 inicialmente.

## ENV

Ver `.env.messaging.example`.

## Deploy incremental

1. deploy código com driver `legacy`;
2. subir RabbitMQ;
3. validar conexão;
4. subir worker sem jobs;
5. ativar `rabbitmq` em ambiente de teste;
6. campanha 1 contato;
7. campanha 5 contatos;
8. testar restart worker;
9. testar pause/resume;
10. aumentar gradualmente.

## Rollback

1. `CAMPAIGN_QUEUE_DRIVER=legacy`;
2. reiniciar Next.js;
3. parar campaign-sender;
4. não apagar filas/dados;
5. contatos `queued/processing` devem ser normalizados para `pending` por script de rollback antes de reativar envio legado.

Criar comando administrativo seguro para essa normalização; não fazê-la automaticamente sem confirmação operacional.

## systemd alternativo

Caso não use PM2, criar unit com:
- WorkingDirectory do projeto;
- EnvironmentFile;
- ExecStart Node/tsx worker;
- Restart=on-failure;
- RestartSec=5;
- SIGTERM shutdown gracioso.
