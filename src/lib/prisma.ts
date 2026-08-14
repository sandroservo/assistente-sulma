/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type LeadStatus =
  | "NOVO"
  | "EM_ATENDIMENTO"
  | "CONSCIENTIZADO"
  | "QUALIFICADO"
  | "LEAD_FRIO"
  | "PROPOSTA_ENVIADA"
  | "EM_NEGOCIACAO"
  | "AGUARDANDO_RESPOSTA"
  | "FECHADO"
  | "PERDIDO"
  | "HUMANO_SOLICITADO"
  | "HUMANO_EM_ATENDIMENTO";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

// Lazy initialization - só cria o cliente quando for usado
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});
