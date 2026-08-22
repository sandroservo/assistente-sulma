# ADR-002 — Worker fora de Docker via PM2/systemd

**Status:** Aceito

## Contexto
O CRM roda fora de Docker; apenas infraestrutura roda containerizada.

## Decisão
Executar `campaign-sender` como processo Node separado sob PM2 ou systemd. RabbitMQ e PostgreSQL permanecem em Docker.

## Consequência
Mantém o padrão operacional atual e evita containerizar a aplicação como pré-requisito da migração.
