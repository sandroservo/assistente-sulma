# ADR-001 — RabbitMQ como work queue de campanhas

**Status:** Aceito

## Contexto
O processamento atual vive dentro do processo Next.js e usa PostgreSQL para claim de jobs.

## Decisão
Usar RabbitMQ para entrega de trabalho assíncrono, mantendo PostgreSQL como fonte de verdade.

## Consequências

Positivas:
- worker isolado;
- redelivery/retry/DLQ;
- deploy web não precisa controlar loop de campanha.

Custos:
- novo componente operacional;
- necessidade de idempotência;
- consistência DB+broker é eventual.
