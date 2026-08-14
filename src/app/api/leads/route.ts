/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para listar leads com busca e filtros
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 20;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
    const take = Math.min(200, Math.max(1, Number(searchParams.get("take")) || DEFAULT_TAKE));
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";

    // Filtros dinâmicos
    const where: Prisma.LeadWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { pushName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    if (category && category !== "todos") {
      where.category = category;
    }

    const leadsData = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: "desc" },
          select: { id: true },
        },
        tags: {
          select: { id: true, name: true, color: true },
        },
        handoffs: {
          where: { status: "assigned" },
          take: 1,
          include: {
            assignedTo: {
              select: { name: true, avatar: true },
            },
          },
        },
      },
      skip,
      take: take + 1,
    });

    const hasMore = leadsData.length > take;
    const page = leadsData.slice(0, take);

    const leads = page.map((lead) => ({
      id: lead.id,
      name: lead.name,
      pushName: lead.pushName ?? null,
      phone: lead.phone,
      status: lead.status,
      ownerType: lead.ownerType,
      category: lead.category,
      summary: lead.summary,
      priority: lead.priority,
      source: lead.source,
      leadScore: lead.leadScore ?? 0,
      updatedAt: lead.updatedAt.toISOString(),
      createdAt: lead.createdAt.toISOString(),
      conversationId: lead.conversations[0]?.id ?? null,
      tags: lead.tags,
      responsible: lead.handoffs[0]?.assignedTo ?? null,
    }));

    return NextResponse.json({ leads, hasMore });
  } catch (error) {
    console.error("Erro ao buscar leads:", error);
    return NextResponse.json({ leads: [], hasMore: false }, { status: 500 });
  }
}
