/**
 * Disparo pela tela de campanha foi desativado.
 * O envio é feito em Contatos → Disparo em Massa (`POST /api/broadcast`).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "O disparo é feito em Contatos → Disparo em Massa." },
    { status: 400 }
  );
}
