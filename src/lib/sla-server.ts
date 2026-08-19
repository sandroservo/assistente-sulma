/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Métricas de SLA que tocam o banco (TME/TMA/TMR, doc §5.2). Server-only —
 * mantido fora de sla.ts porque este importa prisma/pg e sla.ts é usado no client.
 */

import { prisma } from "@/lib/prisma";

export interface OrgSlaMetrics {
  tmeSeconds: number; // Tempo Médio de Espera (fila → primeiro atendimento)
  tmaSeconds: number; // Tempo Médio de Atendimento (início → encerramento)
  tmrSeconds: number; // Tempo Médio de Resposta (msg do contato → resposta do agente)
}

/**
 * Métricas TME/TMA/TMR da organização na janela [since, agora].
 * ponytail: best-effort sobre os timestamps existentes (Handoff/Message);
 * quando houver máquina de estados de atendimento dedicada, refinar.
 */
export async function computeOrgSla(organizationId: string, since: Date): Promise<OrgSlaMetrics> {
  // TME: handoff aberto (createdAt) → atribuído (updatedAt quando status='assigned'/'closed')
  const tme = await prisma.$queryRaw<Array<{ avg: number | null }>>`
    SELECT AVG(EXTRACT(EPOCH FROM (h."updatedAt" - h."createdAt"))) as avg
    FROM "Handoff" h
    JOIN "Lead" l ON l.id = h."leadId"
    WHERE l."organizationId" = ${organizationId}
      AND h."createdAt" >= ${since}
      AND h."assignedToId" IS NOT NULL
      AND h."updatedAt" > h."createdAt"
      AND EXTRACT(EPOCH FROM (h."updatedAt" - h."createdAt")) < 86400
  `;

  // TMA: handoff atribuído → encerrado (status='closed')
  const tma = await prisma.$queryRaw<Array<{ avg: number | null }>>`
    SELECT AVG(EXTRACT(EPOCH FROM (h."updatedAt" - h."createdAt"))) as avg
    FROM "Handoff" h
    JOIN "Lead" l ON l.id = h."leadId"
    WHERE l."organizationId" = ${organizationId}
      AND h."createdAt" >= ${since}
      AND h.status = 'closed'
      AND EXTRACT(EPOCH FROM (h."updatedAt" - h."createdAt")) > 0
  `;

  // TMR: mensagem do agente logo após handoff atribuído
  const tmr = await prisma.$queryRaw<Array<{ avg: number | null }>>`
    SELECT AVG(EXTRACT(EPOCH FROM (m."createdAt" - h."updatedAt"))) as avg
    FROM "Message" m
    JOIN "Handoff" h ON h."conversationId" = m."conversationId" AND h."assignedToId" = m."sentByUserId"
    JOIN "Conversation" c ON c.id = m."conversationId"
    JOIN "Lead" l ON l.id = c."leadId"
    WHERE l."organizationId" = ${organizationId}
      AND m.direction = 'out'
      AND m."sentByUserId" IS NOT NULL
      AND m."createdAt" >= ${since}
      AND m."createdAt" > h."updatedAt"
      AND EXTRACT(EPOCH FROM (m."createdAt" - h."updatedAt")) BETWEEN 0 AND 86400
  `;

  return {
    tmeSeconds: Math.round(tme[0]?.avg ?? 0),
    tmaSeconds: Math.round(tma[0]?.avg ?? 0),
    tmrSeconds: Math.round(tmr[0]?.avg ?? 0),
  };
}
