/**
 * Lista clientes vencidos/inadimplentes (consulta o sistema Amo Vidas).
 * GET /api/cobranca?days=&minValue=&search=&status=
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listarClientesVencidos } from "@/lib/amovidas-api";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const result = await listarClientesVencidos({
    days: searchParams.get("days") || undefined,
    minValue: searchParams.get("minValue") || undefined,
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
