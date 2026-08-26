-- Variação por IA passa a ser padrão (parece conversa, reduz bloqueio por msg idêntica)
ALTER TABLE "Campaign" ALTER COLUMN "aiVariation" SET DEFAULT true;
UPDATE "Campaign" SET "aiVariation" = true WHERE "aiVariation" = false;
