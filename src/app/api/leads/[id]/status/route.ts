/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { prisma, LeadStatus } from "@/lib/prisma";
import { VALID_LEAD_STATUSES, normalizeLeadStatus } from "@/lib/lead-funnel";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!status || !(VALID_LEAD_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { ok: false, error: "invalid status" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { status: normalizeLeadStatus(status) as LeadStatus },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    console.error("Update lead status error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
