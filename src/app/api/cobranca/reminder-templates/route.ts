import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchReminderTemplates } from "@/lib/amovidas-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const situation = url.searchParams.get("situation") || undefined;

  const result = await fetchReminderTemplates(situation);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
