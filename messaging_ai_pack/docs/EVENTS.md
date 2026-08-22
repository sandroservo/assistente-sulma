# Contratos de eventos/jobs

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "campaign.message.send",
  "eventVersion": 1,
  "occurredAt": "2026-08-22T19:00:00.000Z",
  "correlationId": "uuid",
  "organizationId": "cuid",
  "payload": {}
}
```

## campaign.message.send v1

Payload mínimo:

```json
{
  "jobId": "uuid",
  "campaignId": "cuid",
  "runId": "cuid",
  "campaignContactId": "cuid",
  "requestedByUserId": "cuid-or-null",
  "attempt": 0
}
```

Não colocar token Evolution no job. Não colocar mediaBase64 grande no RabbitMQ. Worker carrega conteúdo atual no banco por IDs.

## Por que o job referencia IDs em vez do texto

- payload pequeno;
- evita duplicar dados sensíveis;
- worker sempre respeita estado mais recente da campanha;
- pause/cancel e edição são visíveis antes do envio.

## Eventos observacionais opcionais

No MVP não é necessário criar uma exchange separada para cada status. Logs + banco são suficientes. Depois, caso outros sistemas precisem reagir:

- `campaign.message.sent.v1`
- `campaign.message.failed.v1`
- `campaign.run.completed.v1`
