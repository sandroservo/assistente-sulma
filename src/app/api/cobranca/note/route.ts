/**
 * Observações de cobrança de um cliente (proxy para o sistema Amo Vidas).
 * GET  /api/cobranca/note?user_id=&asaas_customer_id=
 * POST /api/cobranca/note  { userId?, asaasCustomerId?, asaasPaymentId?, note, status? }
 *
 * O autor (author_name) é preenchido com o atendente logado na Sulma.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listarObservacoesCobranca,
  salvarObservacaoCobranca,
} from "@/lib/amovidas-api";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const asaasCustomerId = searchParams.get("asaas_customer_id");

  const result = await listarObservacoesCobranca({
    userId: userId ? Number(userId) : null,
    asaasCustomerId: asaasCustomerId || null,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, asaasCustomerId, asaasPaymentId, note, status } = body;

  if (!note || !String(note).trim()) {
    return NextResponse.json({ ok: false, error: "Observação obrigatória" }, { status: 400 });
  }

  const result = await salvarObservacaoCobranca({
    userId: userId ?? null,
    asaasCustomerId: asaasCustomerId ?? null,
    asaasPaymentId: asaasPaymentId ?? null,
    note: String(note).trim(),
    status,
    authorName: session.user.name || session.user.email || "Atendente Sulma",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
