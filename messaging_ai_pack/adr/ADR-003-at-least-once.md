# ADR-003 — Entrega at-least-once com consumidor idempotente

**Status:** Aceito

RabbitMQ pode redeliver após falha de conexão/crash. Não prometer exactly-once. O consumidor deve verificar estado no PostgreSQL e tornar reprocessamento seguro.
