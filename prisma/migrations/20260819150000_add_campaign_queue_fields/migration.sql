-- Campos de idempotência/rastreabilidade RabbitMQ no CampaignContact (messaging_ai_pack)
ALTER TABLE "CampaignContact"
  ADD COLUMN IF NOT EXISTS "queueJobId"     TEXT,
  ADD COLUMN IF NOT EXISTS "queuedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attemptCount"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notBefore"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastQueueError" TEXT;

-- queueJobId único (trava de reenvio). Postgres permite múltiplos NULL em unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignContact_queueJobId_key"
  ON "CampaignContact"("queueJobId");

CREATE INDEX IF NOT EXISTS "CampaignContact_runId_status_idx" ON "CampaignContact"("runId", "status");
CREATE INDEX IF NOT EXISTS "CampaignContact_status_notBefore_idx" ON "CampaignContact"("status", "notBefore");
