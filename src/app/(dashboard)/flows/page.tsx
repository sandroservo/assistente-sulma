/**
 * Fluxos — editor visual de chatbot (MVP).
 */

import { getSessionOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlowsList } from "./ui/FlowsList";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const session = await getSessionOrRedirect();
  const flows = await prisma.flow.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, active: true, updatedAt: true },
  });

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 max-w-4xl">
      <FlowsList initialFlows={JSON.parse(JSON.stringify(flows))} />
    </div>
  );
}
