/**
 * Editor de um fluxo.
 */

import { notFound } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlowEditor } from "../ui/FlowEditor";

export const dynamic = "force-dynamic";

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrRedirect();
  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!flow) notFound();

  return <FlowEditor flow={JSON.parse(JSON.stringify(flow))} />;
}
