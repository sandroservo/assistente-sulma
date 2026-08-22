import { z } from "zod";

export const CampaignSendJobV1 = z.object({
  eventId: z.string().min(1),
  eventType: z.literal("campaign.message.send"),
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
