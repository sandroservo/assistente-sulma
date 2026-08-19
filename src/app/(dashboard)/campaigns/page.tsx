/**
 * Campanhas — modelos de mensagem. O disparo é feito em Contatos.
 */

import { getSessionOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignsManager } from "./ui/CampaignsManager";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getSessionOrRedirect();
  const orgId = session.user.organizationId;

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, status: true, total: true, sent: true, failed: true, skipped: true, pauseReason: true, startedAt: true },
      },
    },
  });

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-6 max-w-6xl">
      <CampaignsManager initialCampaigns={JSON.parse(JSON.stringify(campaigns))} />
    </div>
  );
}
