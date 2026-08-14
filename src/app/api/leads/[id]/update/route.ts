/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Endpoint para atualizar dados do lead (nome, email, telefone, resumo)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { name, email, phone, city, notes, summary, category, priority, tagIds } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) updateData.email = email || null;
    if (phone) updateData.phone = phone;
    if (city !== undefined) updateData.city = city || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (summary !== undefined) updateData.summary = summary || null;
    if (category) updateData.category = category;
    if (priority) updateData.priority = priority;

    // Atualiza tags via relação many-to-many (set substitui todas)
    if (Array.isArray(tagIds)) {
      updateData.tags = {
        set: tagIds.map((tagId: string) => ({ id: tagId })),
      };
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: { tags: true },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
