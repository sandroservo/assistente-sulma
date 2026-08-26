-- Variação de mensagem por IA (opt-in por campanha)
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "aiVariation" BOOLEAN NOT NULL DEFAULT false;
