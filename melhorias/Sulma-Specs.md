# Sulma Specs

_Documento único consolidado a partir da pasta `melhorias/` (specs de mensageria RabbitMQ + gateway de proxy residencial)._


## Índice

- README.md — `melhorias/sulma-specs/README.md`
- TASKS.md — `melhorias/sulma-specs/TASKS.md`
- SPEC-01-rabbitmq.md — `melhorias/sulma-specs/specs/SPEC-01-rabbitmq.md`
- SPEC-02-worker-standalone.md — `melhorias/sulma-specs/specs/SPEC-02-worker-standalone.md`
- SPEC-03-idempotencia.md — `melhorias/sulma-specs/specs/SPEC-03-idempotencia.md`
- SPEC-04-retry-dlq.md — `melhorias/sulma-specs/specs/SPEC-04-retry-dlq.md`
- SPEC-05-controle-campanha.md — `melhorias/sulma-specs/specs/SPEC-05-controle-campanha.md`
- SPEC-06-throughput.md — `melhorias/sulma-specs/specs/SPEC-06-throughput.md`
- SPEC-07-observabilidade.md — `melhorias/sulma-specs/specs/SPEC-07-observabilidade.md`
- SPEC-08-recuperacao-testes.md — `melhorias/sulma-specs/specs/SPEC-08-recuperacao-testes.md`
- SPEC-09-migracao.md — `melhorias/sulma-specs/specs/SPEC-09-migracao.md`
- README.md — `melhorias/sulma-specs-proxy/README.md`
- TASKS.md — `melhorias/sulma-specs-proxy/TASKS.md`
- SPEC-10-proxy-gateway.md — `melhorias/sulma-specs-proxy/specs/SPEC-10-proxy-gateway.md`
- SPEC-11-residential-node-agent.md — `melhorias/sulma-specs-proxy/specs/SPEC-11-residential-node-agent.md`
- SPEC-12-evolution-proxy-integration.md — `melhorias/sulma-specs-proxy/specs/SPEC-12-evolution-proxy-integration.md`
- SPEC-13-sticky-health-failover.md — `melhorias/sulma-specs-proxy/specs/SPEC-13-sticky-health-failover.md`
- SPEC-14-security-observability.md — `melhorias/sulma-specs-proxy/specs/SPEC-14-security-observability.md`

---



<!-- ===== fonte: melhorias/sulma-specs/README.md ===== -->

# Sulma — Specs de Mensageria

Pacote de especificações para consolidação da mensageria da Sulma com RabbitMQ, worker standalone, idempotência, retry/DLQ, controle de campanhas, throughput, observabilidade, recuperação de falhas e migração gradual.

## Ordem de implementação
1. SPEC-01 — RabbitMQ
2. SPEC-02 — Worker standalone
3. SPEC-03 — Claim, lease e idempotência
4. SPEC-04 — Retry e DLQ
5. SPEC-05 — Pause, Resume e Cancel
6. SPEC-06 — Throughput e backpressure
7. SPEC-07 — Observabilidade
8. SPEC-08 — Recuperação e smoke tests
9. SPEC-09 — Migração Legacy → RabbitMQ

Consulte `TASKS.md` para a trilha central de execução.


---



<!-- ===== fonte: melhorias/sulma-specs/TASKS.md ===== -->

# Sulma — TASKS

Legenda: `[ ]` pendente · `[~]` parcial/em validação · `[x]` concluído.

## Fase 1 — RabbitMQ
- [ ] SULMA-MSG-001 Revisar `rabbit.ts`
- [ ] SULMA-MSG-002 Revisar `topology.ts`
- [ ] SULMA-MSG-003 Padronizar exchanges/queues/routing keys
- [ ] SULMA-MSG-004 Publisher confirms
- [ ] SULMA-MSG-005 Reconexão automática
- [ ] SULMA-MSG-006 Tratamento de channel/connection failure
- [ ] SULMA-MSG-007 DLQ
- [ ] SULMA-MSG-008 Health check RabbitMQ

## Fase 2 — Worker standalone
- [ ] SULMA-WRK-001 Entrypoint standalone
- [~] SULMA-WRK-002 Condicionar worker legado ao queue driver
- [ ] SULMA-WRK-003 Preservar modo legacy
- [ ] SULMA-WRK-004 Graceful shutdown
- [ ] SULMA-WRK-005 SIGTERM/SIGINT
- [ ] SULMA-WRK-006 Recuperação após restart
- [ ] SULMA-WRK-007 Health/readiness

## Fase 3 — Idempotência
- [~] SULMA-IDEM-001 Claim atômico pending -> sending
- [~] SULMA-IDEM-002 Impedir claim concorrente de sending
- [~] SULMA-IDEM-003 Lease de processamento
- [~] SULMA-IDEM-004 Recuperação de lease expirado
- [ ] SULMA-IDEM-005 Chave de idempotência
- [ ] SULMA-IDEM-006 Redelivery
- [ ] SULMA-IDEM-007 Proteção de contato sent
- [ ] SULMA-IDEM-008 Registro de tentativa
- [ ] SULMA-IDEM-009 Teste multi-worker

## Fase 4 — Retry/DLQ
- [ ] SULMA-RTY-001 Classificação de erros
- [ ] SULMA-RTY-002 Exponential backoff
- [ ] SULMA-RTY-003 Jitter operacional
- [ ] SULMA-RTY-004 maxAttempts
- [ ] SULMA-RTY-005 DLQ definitiva
- [ ] SULMA-RTY-006 lastError
- [ ] SULMA-RTY-007 attemptCount
- [ ] SULMA-RTY-008 Reprocessamento administrativo

## Fase 5 — Controle
- [ ] SULMA-CTL-001 Consultar CampaignRun
- [ ] SULMA-CTL-002 Pause
- [ ] SULMA-CTL-003 Resume
- [ ] SULMA-CTL-004 Cancel
- [ ] SULMA-CTL-005 Bloquear novos contatos no pause
- [ ] SULMA-CTL-006 Preservar pendentes
- [ ] SULMA-CTL-007 Cancelamento terminal
- [ ] SULMA-CTL-008 Atualização do painel

## Fase 6 — Throughput
- [ ] SULMA-RATE-001 Rate limiter por instância
- [ ] SULMA-RATE-002 Limite global
- [ ] SULMA-RATE-003 Concorrência
- [ ] SULMA-RATE-004 Backpressure
- [ ] SULMA-RATE-005 Janela operacional
- [ ] SULMA-RATE-006 Circuit breaker
- [ ] SULMA-RATE-007 Adaptação a 429/falhas
- [ ] SULMA-RATE-008 Opt-out

## Fase 7 — Observabilidade
- [ ] SULMA-OBS-001 Logging estruturado
- [ ] SULMA-OBS-002 Correlation ID
- [ ] SULMA-OBS-003 queued
- [ ] SULMA-OBS-004 processing
- [ ] SULMA-OBS-005 sent
- [ ] SULMA-OBS-006 failed
- [ ] SULMA-OBS-007 retry
- [ ] SULMA-OBS-008 DLQ
- [ ] SULMA-OBS-009 Latência
- [ ] SULMA-OBS-010 Dashboard

## Fase 8 — Testes
- [ ] RabbitMQ down/up
- [ ] Worker crash/restart
- [ ] Next.js restart
- [ ] Provider indisponível
- [ ] Postgres indisponível
- [ ] Redelivery
- [ ] Lease expirado
- [ ] Pause durante processamento
- [ ] Cancel durante processamento
- [ ] Multi-worker

## Fase 9 — Migração
- [ ] SULMA-MIG-001 Validar legacy
- [ ] SULMA-MIG-002 Validar RabbitMQ
- [ ] SULMA-MIG-003 Smoke tests
- [ ] SULMA-MIG-004 Campanha interna pequena
- [ ] SULMA-MIG-005 Observar métricas
- [ ] SULMA-MIG-006 Rollout gradual
- [ ] SULMA-MIG-007 Rollback documentado
- [ ] SULMA-MIG-008 Depreciar legado após estabilização


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-01-rabbitmq.md ===== -->

# SPEC-01 — Arquitetura da fila RabbitMQ

## Objetivo
Consolidar RabbitMQ como mecanismo principal de processamento de campanhas.

## Tarefas
- SULMA-MSG-001 — Revisar `rabbit.ts`.
- SULMA-MSG-002 — Revisar `topology.ts`.
- SULMA-MSG-003 — Padronizar exchanges, queues e routing keys.
- SULMA-MSG-004 — Implementar publisher confirms.
- SULMA-MSG-005 — Implementar reconexão automática.
- SULMA-MSG-006 — Tratar falhas de channel/connection.
- SULMA-MSG-007 — Criar DLQ.
- SULMA-MSG-008 — Adicionar health check RabbitMQ.

## Critério de aceite
Indisponibilidade temporária do RabbitMQ não pode corromper `CampaignRun` nem provocar duplicidade lógica de envio.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-02-worker-standalone.md ===== -->

# SPEC-02 — Worker standalone

## Objetivo
Remover a execução do campaign worker de dentro do processo Next.js quando RabbitMQ estiver ativo.

## Tarefas
- SULMA-WRK-001 — Criar entrypoint próprio do worker.
- SULMA-WRK-002 — Impedir inicialização do worker legado quando `CAMPAIGN_QUEUE_DRIVER=rabbitmq`.
- SULMA-WRK-003 — Preservar worker Postgres quando driver for `legacy`.
- SULMA-WRK-004 — Implementar graceful shutdown.
- SULMA-WRK-005 — Tratar `SIGTERM` e `SIGINT`.
- SULMA-WRK-006 — Garantir recuperação após restart.
- SULMA-WRK-007 — Criar health/readiness do worker.

## Critério de aceite
Next.js e worker podem reiniciar independentemente, sem perda de estado da campanha.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-03-idempotencia.md ===== -->

# SPEC-03 — Claim, lease e idempotência

## Objetivo
Evitar processamento concorrente e duplicidade funcional mesmo com redelivery e múltiplos workers.

## Tarefas
- SULMA-IDEM-001 — Claim atômico `pending -> sending`.
- SULMA-IDEM-002 — Impedir claim concorrente de contatos em `sending`.
- SULMA-IDEM-003 — Criar lease de processamento.
- SULMA-IDEM-004 — Recuperar lease expirado.
- SULMA-IDEM-005 — Criar chave de idempotência por envio.
- SULMA-IDEM-006 — Detectar redelivery RabbitMQ.
- SULMA-IDEM-007 — Impedir reenvio de contato já `sent`.
- SULMA-IDEM-008 — Registrar tentativa antes/depois do provider.
- SULMA-IDEM-009 — Testar múltiplos workers na mesma fila.

## Critério de aceite
Executar vários workers simultaneamente não pode gerar duplicidade lógica de envio.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-04-retry-dlq.md ===== -->

# SPEC-04 — Retry e DLQ

## Objetivo
Classificar falhas e aplicar retry apenas quando apropriado.

## Classes de erro
- `TRANSIENT` — retry.
- `RATE_LIMIT` — retry/backoff.
- `PROVIDER_UNAVAILABLE` — retry.
- `INVALID_NUMBER` — permanente.
- `OPT_OUT` — não enviar.
- `PERMANENT` — falha definitiva/DLQ.

## Tarefas
- SULMA-RTY-001 — Criar classificação de erros.
- SULMA-RTY-002 — Implementar retry com exponential backoff.
- SULMA-RTY-003 — Adicionar jitter operacional.
- SULMA-RTY-004 — Definir `maxAttempts`.
- SULMA-RTY-005 — Encaminhar falha definitiva para DLQ.
- SULMA-RTY-006 — Registrar `lastError`.
- SULMA-RTY-007 — Registrar `attemptCount`.
- SULMA-RTY-008 — Criar reprocessamento administrativo da DLQ.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-05-controle-campanha.md ===== -->

# SPEC-05 — Pause, Resume e Cancel

## Objetivo
Permitir controle seguro de uma campanha em processamento.

## Tarefas
- SULMA-CTL-001 — Worker consultar estado atual do `CampaignRun`.
- SULMA-CTL-002 — Implementar `PAUSED`.
- SULMA-CTL-003 — Implementar `RESUME`.
- SULMA-CTL-004 — Implementar `CANCELLED`.
- SULMA-CTL-005 — Não iniciar novos contatos de campanha pausada.
- SULMA-CTL-006 — Preservar contatos pendentes no pause.
- SULMA-CTL-007 — Impedir reativação de campanha cancelada.
- SULMA-CTL-008 — Atualizar painel com estado atual.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-06-throughput.md ===== -->

# SPEC-06 — Throughput e backpressure

## Objetivo
Proteger a infraestrutura, respeitar limites operacionais do provider e evitar rajadas descontroladas.

## Tarefas
- SULMA-RATE-001 — Rate limiter por instância.
- SULMA-RATE-002 — Limite global de processamento.
- SULMA-RATE-003 — Controle de concorrência.
- SULMA-RATE-004 — Implementar backpressure.
- SULMA-RATE-005 — Janela operacional configurável.
- SULMA-RATE-006 — Circuit breaker para provider indisponível.
- SULMA-RATE-007 — Reduzir throughput diante de 429/falhas do provider.
- SULMA-RATE-008 — Bloquear processamento de contatos com opt-out.

## Restrição
O mecanismo deve ser baseado em limites técnicos, consentimento e sinais reais do provider; não deve tentar simular comportamento humano ou contornar controles anti-spam.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-07-observabilidade.md ===== -->

# SPEC-07 — Observabilidade

## Objetivo
Permitir rastreamento ponta a ponta de cada job.

## Contexto mínimo do job
- `jobId`
- `campaignId`
- `runId`
- `contactId`
- `instanceId`
- `attempt`
- `correlationId`
- `createdAt`

## Tarefas
- SULMA-OBS-001 — Logging estruturado.
- SULMA-OBS-002 — Correlation ID.
- SULMA-OBS-003 — Métrica `queued`.
- SULMA-OBS-004 — Métrica `processing`.
- SULMA-OBS-005 — Métrica `sent`.
- SULMA-OBS-006 — Métrica `failed`.
- SULMA-OBS-007 — Métrica `retry`.
- SULMA-OBS-008 — Métrica `DLQ`.
- SULMA-OBS-009 — Medir latência.
- SULMA-OBS-010 — Dashboard operacional.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-08-recuperacao-testes.md ===== -->

# SPEC-08 — Recuperação de falhas e smoke tests

## Cenários obrigatórios
- RabbitMQ cai e retorna.
- Worker cai e reinicia.
- Next.js reinicia.
- Provider/Evolution fica indisponível.
- Postgres fica temporariamente indisponível.
- Mensagem sofre redelivery.
- Contato permanece em `sending` após crash.
- Campanha é pausada durante processamento.
- Campanha é cancelada durante processamento.
- Dois ou mais workers recebem trabalho concorrente.

## Critério de aceite
Nenhum cenário pode provocar corrupção de estado ou duplicação lógica silenciosa.


---



<!-- ===== fonte: melhorias/sulma-specs/specs/SPEC-09-migracao.md ===== -->

# SPEC-09 — Migração Legacy para RabbitMQ

## Feature flags
```env
CAMPAIGN_QUEUE_DRIVER=legacy
```

```env
CAMPAIGN_QUEUE_DRIVER=rabbitmq
```

## Tarefas
- SULMA-MIG-001 — Validar modo legacy.
- SULMA-MIG-002 — Validar modo RabbitMQ.
- SULMA-MIG-003 — Executar smoke tests.
- SULMA-MIG-004 — Rodar campanha interna pequena.
- SULMA-MIG-005 — Observar métricas e erros.
- SULMA-MIG-006 — Aumentar carga gradualmente dentro dos limites operacionais.
- SULMA-MIG-007 — Documentar rollback.
- SULMA-MIG-008 — Depreciar worker legado somente após estabilização.

## Critério de aceite
Rollback para `legacy` deve permanecer simples e documentado durante a migração.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/README.md ===== -->

# Sulma — Residential Egress / Proxy Specs

Complemento das SPECs 01–09 de mensageria da Sulma.

Objetivo: prover egress estável por nós residenciais próprios/autorizados para instâncias Evolution, com associação sticky, health checking, failover controlado, segurança e observabilidade.

> Fora de escopo: rotação de IP para evasão de bloqueios, mascaramento de automação, bypass de controles anti-spam ou uso de dispositivos/conexões sem autorização.

## Arquitetura
Sulma -> RabbitMQ -> Campaign Worker -> Evolution Instance -> Proxy Gateway -> Residential Node -> ISP

Cada EvolutionInstance deve permanecer associada ao mesmo node enquanto saudável. O kali-anonsurf foi avaliado apenas como referência de roteamento; não será dependência, pois direciona tráfego via Tor e não fornece egress residencial sticky.

## Specs
- SPEC-10 Proxy Gateway
- SPEC-11 Residential Node Agent
- SPEC-12 Evolution Proxy Integration
- SPEC-13 Sticky Session, Health & Failover
- SPEC-14 Security & Observability

Consulte TASKS.md para a ordem de implementação.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/TASKS.md ===== -->

# TASKS — Sulma Residential Egress

## Princípios
- [ ] Usar somente nodes/conexões próprios ou autorizados.
- [ ] Sticky egress por EvolutionInstance.
- [ ] Proibir rotação por mensagem/campanha para evasão.
- [ ] Proxy privado e autenticado.
- [ ] Preferir pause/alerta a failover silencioso.

## Fase 0 — Discovery
- [ ] SULMA-PXY-001 Validar HTTP CONNECT/SOCKS5 compatível com Evolution.
- [ ] SULMA-EVO-PXY-001 Mapear configuração de proxy da versão Evolution instalada.
- [ ] SULMA-NODE-001 Fechar protocolo Gateway/Agent.

## Fase 1 — Gateway
- [ ] SULMA-PXY-002 Serviço standalone.
- [ ] SULMA-PXY-003 Autenticação.
- [ ] SULMA-PXY-004 Registry.
- [ ] SULMA-PXY-005 Bindings.
- [ ] SULMA-PXY-006 Forwarding.
- [ ] SULMA-PXY-007 Limites/timeouts.
- [ ] SULMA-PXY-008 Health/readiness.
- [ ] SULMA-PXY-009 Anti-open-proxy.

## Fase 2 — Node Agent
- [ ] SULMA-NODE-002 Agent.
- [ ] SULMA-NODE-003 Enrollment.
- [ ] SULMA-NODE-004 Reverse tunnel.
- [ ] SULMA-NODE-005 Heartbeat.
- [ ] SULMA-NODE-006 Reconnect/backoff.
- [ ] SULMA-NODE-007 systemd.
- [ ] SULMA-NODE-008 Installer.
- [ ] SULMA-NODE-009 Isolamento LAN.
- [ ] SULMA-NODE-010 Versionamento.

## Fase 3 — Evolution/Sulma
- [ ] SULMA-EVO-PXY-002 Modelo ProxyNode.
- [ ] SULMA-EVO-PXY-003 Binding EvolutionInstance.
- [ ] SULMA-EVO-PXY-004 Configuração.
- [ ] SULMA-EVO-PXY-005 Connectivity check.
- [ ] SULMA-EVO-PXY-006 Worker awareness.
- [ ] SULMA-EVO-PXY-007 UI administrativa.
- [ ] SULMA-EVO-PXY-008 Audit log.
- [ ] SULMA-EVO-PXY-009 Feature flag.

## Fase 4 — Health/Failover
- [ ] SULMA-HLT-001 State machine.
- [ ] SULMA-HLT-002 Heartbeat TTL.
- [ ] SULMA-HLT-003 Latência/falhas.
- [ ] SULMA-HLT-004 Draining.
- [ ] SULMA-HLT-005 Integração worker.
- [ ] SULMA-HLT-006 Pause on offline.
- [ ] SULMA-HLT-007 Failover opt-in.
- [ ] SULMA-HLT-008 Alertas.

## Fase 5 — Security/Observability
- [ ] SULMA-SEC-001 TLS.
- [ ] SULMA-SEC-002 Credenciais por node.
- [ ] SULMA-SEC-003 Revogação.
- [ ] SULMA-SEC-004 RBAC.
- [ ] SULMA-SEC-005 Egress allowlist.
- [ ] SULMA-SEC-006 Bloqueio LAN/pivot.
- [ ] SULMA-SEC-007 Audit log.
- [ ] SULMA-OBS-PXY-001 Logs estruturados.
- [ ] SULMA-OBS-PXY-002 Métricas Gateway.
- [ ] SULMA-OBS-PXY-003 Métricas Nodes.
- [ ] SULMA-OBS-PXY-004 Dashboard.
- [ ] SULMA-OBS-PXY-005 Alertas.
- [ ] SULMA-SEC-008 Threat model.

## Fase 6 — Testes/Rollout
- [ ] SULMA-PXY-010 Testes de integração.
- [ ] SULMA-NODE-011 Teste NAT/CGNAT.
- [ ] SULMA-HLT-009 Teste queda/retorno node.
- [ ] SULMA-HLT-010 Teste restart Gateway.
- [ ] Testar restart Evolution mantendo binding.
- [ ] Testar RabbitMQ redelivery sem alteração de binding.
- [ ] Testar revogação de node.
- [ ] Testar node DEGRADED/OFFLINE.
- [ ] Rollout inicial com uma instância de laboratório.
- [ ] Documentar rollback.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/specs/SPEC-10-proxy-gateway.md ===== -->

# SPEC-10 — Proxy Gateway

## Objetivo
Criar um gateway central que receba conexões das instâncias Evolution e encaminhe o tráfego por um Residential Node previamente autorizado.

## Requisitos
- Suporte a proxy HTTP CONNECT e/ou SOCKS5 conforme compatibilidade validada com Evolution.
- Autenticação obrigatória entre Evolution/Gateway e Gateway/Node.
- Associação explícita `evolutionInstanceId -> proxyNodeId`.
- Nunca escolher node aleatoriamente por mensagem.
- Timeouts, connection pooling e limites de concorrência configuráveis.
- Gateway não deve expor proxy aberto à Internet.
- API administrativa para listar nodes, bindings e estado.

## Tarefas
- SULMA-PXY-001 — Definir protocolo de proxy suportado pela Evolution.
- SULMA-PXY-002 — Criar serviço Proxy Gateway standalone.
- SULMA-PXY-003 — Implementar autenticação do cliente.
- SULMA-PXY-004 — Implementar registry de nodes.
- SULMA-PXY-005 — Implementar binding instance/node.
- SULMA-PXY-006 — Implementar encaminhamento de conexão.
- SULMA-PXY-007 — Implementar limites de conexão e timeouts.
- SULMA-PXY-008 — Criar health/readiness endpoints.
- SULMA-PXY-009 — Bloquear comportamento de open proxy.
- SULMA-PXY-010 — Criar testes de integração.

## Critérios de aceite
- Uma instância vinculada ao Node A sempre utiliza Node A enquanto saudável.
- Cliente sem credencial não consegue utilizar o gateway.
- Node não autorizado nunca entra no registry.
- Reinício do gateway não altera silenciosamente os bindings persistidos.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/specs/SPEC-11-residential-node-agent.md ===== -->

# SPEC-11 — Residential Node Agent

## Objetivo
Criar um agente leve para Linux executado exclusivamente em hosts/conexões residenciais próprios ou expressamente autorizados.

## Modelo de conexão
O node inicia uma conexão de saída para o Gateway (reverse tunnel), permitindo operação atrás de NAT/CGNAT sem exposição de portas residenciais.

## Requisitos
- Identidade única do node.
- Enrollment controlado.
- Credencial rotacionável.
- Heartbeat periódico.
- Reconexão com backoff.
- Reporte de versão, uptime e capacidade.
- Serviço systemd.
- Upgrade controlado.
- Sem acesso arbitrário à LAN do node.

## Tarefas
- SULMA-NODE-001 — Definir protocolo Gateway/Agent.
- SULMA-NODE-002 — Criar agent standalone.
- SULMA-NODE-003 — Implementar enrollment.
- SULMA-NODE-004 — Implementar reverse tunnel.
- SULMA-NODE-005 — Implementar heartbeat.
- SULMA-NODE-006 — Implementar reconexão/backoff.
- SULMA-NODE-007 — Criar unit systemd.
- SULMA-NODE-008 — Criar instalador idempotente.
- SULMA-NODE-009 — Restringir destinos e acesso à LAN.
- SULMA-NODE-010 — Implementar atualização/versionamento.
- SULMA-NODE-011 — Testar NAT e CGNAT.

## Critérios de aceite
- Node reconecta automaticamente após perda da Internet.
- Gateway identifica node offline após expiração do heartbeat.
- Nenhuma porta inbound precisa ser aberta no roteador residencial.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/specs/SPEC-12-evolution-proxy-integration.md ===== -->

# SPEC-12 — Evolution Proxy Integration

## Objetivo
Integrar o Proxy Gateway ao ciclo de vida das instâncias Evolution sem alterar a semântica das campanhas Sulma.

## Requisitos
- Persistir `proxyNodeId` por EvolutionInstance.
- Configurar proxy por instância usando mecanismo suportado pela versão da Evolution em uso.
- Validar proxy antes de ativar a instância.
- Exibir binding no painel administrativo.
- Worker não deve decidir/rotacionar IP por mensagem.
- Alteração de node deve ser ação administrativa auditável ou failover explicitamente autorizado.

## Tarefas
- SULMA-EVO-PXY-001 — Mapear suporte de proxy da versão Evolution utilizada.
- SULMA-EVO-PXY-002 — Adicionar modelo ProxyNode.
- SULMA-EVO-PXY-003 — Adicionar binding na EvolutionInstance.
- SULMA-EVO-PXY-004 — Criar serviço de configuração do proxy.
- SULMA-EVO-PXY-005 — Criar teste de conectividade antes da ativação.
- SULMA-EVO-PXY-006 — Integrar estado do proxy ao worker.
- SULMA-EVO-PXY-007 — Criar UI de binding.
- SULMA-EVO-PXY-008 — Registrar alterações em audit log.
- SULMA-EVO-PXY-009 — Implementar feature flag.

## Critérios de aceite
- Instância sem proxy saudável não inicia processamento quando proxy for obrigatório.
- O mesmo binding é preservado entre jobs e reinícios.
- Troca de node é rastreável.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/specs/SPEC-13-sticky-health-failover.md ===== -->

# SPEC-13 — Sticky Session, Health & Failover

## Objetivo
Manter estabilidade de egress e reagir de forma segura a falhas reais de infraestrutura.

## Estados do node
`ENROLLING`, `HEALTHY`, `DEGRADED`, `OFFLINE`, `DRAINING`, `DISABLED`.

## Regras
- Sticky binding é o padrão.
- Não trocar node apenas para obter outro IP.
- DEGRADED reduz/admite bloqueio de novos trabalhos conforme política.
- OFFLINE pausa trabalhos dependentes do node.
- Failover automático deve ser opcional e explicitamente configurado.
- Preferir pausar e alertar a trocar egress silenciosamente.

## Tarefas
- SULMA-HLT-001 — Implementar state machine.
- SULMA-HLT-002 — Implementar heartbeat TTL.
- SULMA-HLT-003 — Medir latência e falhas de conexão.
- SULMA-HLT-004 — Implementar draining.
- SULMA-HLT-005 — Integrar health com Campaign Worker.
- SULMA-HLT-006 — Pausar processamento quando node obrigatório estiver offline.
- SULMA-HLT-007 — Criar política de failover configurável.
- SULMA-HLT-008 — Criar alertas.
- SULMA-HLT-009 — Testar queda/retorno do node.
- SULMA-HLT-010 — Testar reinício de Gateway.

## Critérios de aceite
- Queda do node não gera loop de retries de mensagens.
- Retorno do mesmo node permite retomada controlada.
- Failover nunca acontece fora da política configurada.


---



<!-- ===== fonte: melhorias/sulma-specs-proxy/specs/SPEC-14-security-observability.md ===== -->

# SPEC-14 — Security & Observability

## Objetivo
Garantir que a infraestrutura de egress seja privada, auditável e operacionalmente observável.

## Segurança
- TLS em todos os enlaces remotos.
- Credenciais distintas por node.
- Segredos fora do código/repositório.
- Revogação de node.
- RBAC para operações administrativas.
- Allowlist de destinos/protocolos necessários.
- Proteção contra open proxy/SSRF/pivot para LAN.
- Logs sem conteúdo de mensagens e sem segredos.

## Observabilidade
Métricas mínimas: node_online, active_connections, connection_errors, gateway_latency, node_latency, bytes_in/out, reconnect_count, binding_changes e failover_count.

## Tarefas
- SULMA-SEC-001 — Implementar TLS.
- SULMA-SEC-002 — Implementar identidade/credencial por node.
- SULMA-SEC-003 — Implementar revogação.
- SULMA-SEC-004 — Implementar RBAC administrativo.
- SULMA-SEC-005 — Implementar egress allowlist.
- SULMA-SEC-006 — Bloquear acesso a redes privadas/LAN não autorizadas.
- SULMA-SEC-007 — Implementar audit log.
- SULMA-OBS-PXY-001 — Logging estruturado.
- SULMA-OBS-PXY-002 — Métricas do Gateway.
- SULMA-OBS-PXY-003 — Métricas dos Nodes.
- SULMA-OBS-PXY-004 — Dashboard operacional.
- SULMA-OBS-PXY-005 — Alertas offline/degraded.
- SULMA-SEC-008 — Threat-model e testes de abuso.

## Critérios de aceite
- Proxy não pode ser utilizado sem autenticação.
- Node revogado perde acesso.
- Gateway não funciona como pivot arbitrário para a rede residencial.
- Operador consegue identificar node, binding, estado e causa de falha sem inspecionar conteúdo das mensagens.


---

