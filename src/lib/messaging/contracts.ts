/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Contrato do job de envio de campanha (v1). Zod valida na publicação e no
 * consumo — job inválido nunca chega à lógica de envio (vai pra DLQ/invalid).
 */

import { z } from "zod";

export const CAMPAIGN_SEND_EVENT = "campaign.message.send";

export const CampaignSendJobV1 = z.object({
  eventId: z.string().min(1),
  eventType: z.literal(CAMPAIGN_SEND_EVENT),
  eventVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1),
  organizationId: z.string().min(1),
  payload: z.object({
    jobId: z.string().min(1),
    campaignId: z.string().min(1),
    runId: z.string().min(1),
    campaignContactId: z.string().min(1),
    requestedByUserId: z.string().nullable().optional(),
    attempt: z.number().int().min(0),
  }),
});

export type CampaignSendJobV1 = z.infer<typeof CampaignSendJobV1>;

/** Monta um job válido a partir dos ids. attempt default 0. */
export function buildCampaignSendJob(input: {
  jobId: string;
  campaignId: string;
  runId: string;
  campaignContactId: string;
  organizationId: string;
  correlationId: string;
  requestedByUserId?: string | null;
  attempt?: number;
  occurredAt: string; // ISO — quem chama passa (Date.now indisponível em alguns contextos)
}): CampaignSendJobV1 {
  return {
    eventId: input.jobId,
    eventType: CAMPAIGN_SEND_EVENT,
    eventVersion: 1,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    organizationId: input.organizationId,
    payload: {
      jobId: input.jobId,
      campaignId: input.campaignId,
      runId: input.runId,
      campaignContactId: input.campaignContactId,
      requestedByUserId: input.requestedByUserId ?? null,
      attempt: input.attempt ?? 0,
    },
  };
}
