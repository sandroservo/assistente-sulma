/**
 * GET /api/contacts/import/template — modelo Excel para importar contatos.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildContactTemplateXlsx } from "@/lib/contact-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const buf = buildContactTemplateXlsx();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-contatos-sulma.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
