/**
 * Filas de disparo de todos os consultores. Só OWNER/ADMIN.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCampaignWorker } from "@/lib/campaign-worker";

export const dynamic = "force-dynamic";

function etaSeconds(run: { sent: number; failed: number; skipped: number; total: number; startedAt: Date }) {
  const processed = run.sent + run.failed + run.skipped;
  const remaining = Math.max(0, run.total - processed);
  if (processed <= 0 || remaining <= 0) return null;
  const elapsed = Date.now() - run.startedAt.getTime();
  return Math.round((remaining * (elapsed / processed)) / 1000);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });
  }

  const runs = await prisma.campaignRun.findMany({
    where: {
      status: { in: ["RUNNING", "PAUSED"] },
      campaign: { organizationId: session.user.organizationId },
    },
    orderBy: { startedAt: "asc" },
    include: {
      campaign: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (runs.some((r) => r.status === "RUNNING")) startCampaignWorker();

  const byUser = new Map<string, {
    userId: string | null;
    userName: string;
    userEmail: string | null;
    runs: Array<{
      id: string;
      campaignName: string;
      status: string;
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      pending: number;
      pauseReason: string | null;
      waitReason: string | null;
      waitUntil: Date | null;
      startedAt: Date;
      etaSeconds: number | null;
    }>;
  }>();

  for (const run of runs) {
    const key = run.createdByUserId || "none";
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: run.createdByUser?.id ?? null,
        userName: run.createdByUser?.name || "Sem responsável",
        userEmail: run.createdByUser?.email ?? null,
        runs: [],
      });
    }
    const processed = run.sent + run.failed + run.skipped;
    byUser.get(key)!.runs.push({
      id: run.id,
      campaignName: run.campaign.name,
      status: run.status,
      total: run.total,
      sent: run.sent,
      failed: run.failed,
      skipped: run.skipped,
      pending: Math.max(0, run.total - processed),
      pauseReason: run.pauseReason,
      waitReason: run.waitReason,
      waitUntil: run.waitUntil,
      startedAt: run.startedAt,
      etaSeconds: etaSeconds(run),
    });
  }

  return NextResponse.json({
    ok: true,
    queues: Array.from(byUser.values()),
  });
}
