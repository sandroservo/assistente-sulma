# RabbitMQ — Topologia

## Exchange principal

`wa.campaign.direct` — tipo `direct`, durable.

Routing key MVP: `campaign.send`.

## Exchange de dead letter

`wa.campaign.dlx` — tipo `direct`, durable.

## Filas

### Principal
`wa.campaign.send.v1`

- durable: true
- x-dead-letter-exchange: `wa.campaign.dlx`
- x-dead-letter-routing-key: `campaign.dead`

### Retry

- `wa.campaign.retry.5s.v1` TTL 5.000ms
- `wa.campaign.retry.30s.v1` TTL 30.000ms
- `wa.campaign.retry.2m.v1` TTL 120.000ms
- `wa.campaign.retry.10m.v1` TTL 600.000ms

Cada retry queue usa dead-letter exchange `wa.campaign.direct` e routing key `campaign.send`, retornando automaticamente à fila principal ao expirar.

### Dead letter
`wa.campaign.dead.v1`

Binding: `wa.campaign.dlx` / `campaign.dead`.

## Publicação

- `deliveryMode=2` / persistent;
- contentType `application/json`;
- messageId = jobId;
- correlationId = correlationId;
- type = `campaign.message.send`;
- headers: `x-event-version=1`, `x-attempt`.

Usar ConfirmChannel e aguardar confirmação do broker.

## Consumer

- `channel.prefetch(1)` no MVP;
- manual ack;
- `noAck=false`;
- handler nunca deve segurar mensagem durante waits longos;
- atraso operacional => retry queue.

## Retry mapping sugerido

attempt 1 -> 5s
attempt 2 -> 30s
attempt 3 -> 2m
attempt 4 -> 10m
attempt 5 -> DLQ

Para rate/capacity wait calculado maior que 10m, o worker pode atualizar `notBefore` e usar a maior retry disponível repetidamente, rechecando no consumo. Não usar `sleep()` longo.

## Futuro: filas por instância

Quando houver múltiplas instâncias ativas e necessidade real de paralelismo:

- exchange `wa.instance.direct`;
- queue `wa.instance.<instanceId>.send.v1`;
- um consumer ativo por fila;
- dispatcher seleciona instanceId antes do roteamento.

Não fazer isso no primeiro commit se hoje há uma única instância de envio.
