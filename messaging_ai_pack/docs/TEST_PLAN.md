# Plano de testes

## Smoke

1. RabbitMQ sobe healthy.
2. Worker conecta.
3. Publicar job sintético inválido -> DLQ/invalid sem crash.
4. Criar campanha com 1 contato permitido -> sent.
5. providerId persistido.

## Funcional

### 5 contatos
- todos entram em queued;
- worker processa sequencialmente;
- contadores do run fecham corretamente;
- nenhum fica `processing` indefinidamente.

### Pause
- iniciar 5;
- após 1 envio pausar run;
- jobs restantes não enviam enquanto PAUSED.

### Resume
- retomar;
- pending/queued continuam sem duplicar primeiro contato.

### Cancel
- cancelar com backlog;
- nenhum novo envio após CANCELLED.

### Opt-out tardio
- publicar job;
- inserir suppression antes do consumo;
- worker deve `skipped`.

## Resiliência

### Restart RabbitMQ
Publisher deve reconectar; worker deve reconectar.

### Restart worker durante processamento
Mensagem não ACKada deve retornar. Idempotência deve evitar duplicação se sucesso já foi persistido.

### Evolution timeout
Job vai para retry, não fica preso em `processing`.

### Evolution 500
Retry com backoff.

### Falha permanente
Vai para failed/DLQ depois da política definida.

## Carga adequada ao caso

Teste com 100 jobs, observando:
- memória do Next.js não cresce por sleeps;
- latência da API broadcast permanece baixa;
- backlog do RabbitMQ reduz de forma previsível;
- banco não apresenta lock contention anormal.

Não usar o teste de carga para contornar limites da plataforma; medir a infraestrutura com provider mock quando necessário.
