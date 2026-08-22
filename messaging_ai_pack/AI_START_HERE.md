# INSTRUÇÃO PARA A IA DE DESENVOLVIMENTO

Você recebeu dois artefatos:

1. o repositório original `assistente-sulma-main`;
2. este pacote de implementação.

Não crie um projeto novo.

## Primeira execução

1. leia `CLAUDE.md`, `SPEC.md`, `TASKS.md`;
2. inspecione no repo original os arquivos listados em `CLAUDE.md`;
3. execute TASK-001 a TASK-006;
4. rode build/lint/tests existentes;
5. só então implemente publisher e worker.

## Regra de segurança de rollout

Mantenha `CAMPAIGN_QUEUE_DRIVER=legacy` até:
- RabbitMQ estar healthy;
- migration aplicada;
- publisher/worker compilarem;
- smoke test local passar.

Depois habilite `rabbitmq` para teste controlado.

## Não fazer

- não apagar o campaign worker antigo no primeiro PR;
- não alterar telas sem necessidade;
- não colocar CRM em Docker;
- não criar fila por usuário/contato;
- não colocar token Evolution na mensagem AMQP;
- não usar sleeps longos no consumer;
- não adicionar Redis/Kafka.
