# Observabilidade

## Logs mínimos

Eventos:
- `publisher.job_published`
- `publisher.job_publish_failed`
- `worker.job_received`
- `worker.job_skipped_terminal`
- `worker.job_deferred`
- `worker.send_started`
- `worker.send_succeeded`
- `worker.send_failed`
- `worker.job_retried`
- `worker.job_dead_lettered`

Campos:
`service`, `event`, `correlationId`, `jobId`, `runId`, `campaignContactId`, `organizationId`, `instanceId`, `attempt`, `durationMs`, `errorKind`.

Nunca logar token, API key ou mediaBase64.

## Métricas sugeridas

- `campaign_jobs_published_total`
- `campaign_jobs_processed_total{result}`
- `campaign_send_duration_ms`
- `campaign_retry_total{reason}`
- `campaign_dlq_total{reason}`
- `campaign_worker_inflight`
- `campaign_queue_depth` (coletada do RabbitMQ)

MVP pode começar com logs estruturados; Prometheus entra depois sem bloquear migração.
