/**
 * Campanhas não disparam mais automaticamente.
 * O envio é feito em Contatos → Disparo em Massa.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    processed: 0,
    message: "Campanhas não disparam automaticamente. Use Contatos → Disparo em Massa.",
  });
}
