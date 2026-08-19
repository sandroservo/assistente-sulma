/**
 * Grava o fluxo UNISULMA no editor /flows.
 * Uso: npx tsx scripts/seed-unisulma-flow.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { UNISULMA_FLOW_NAME, UNISULMA_SECTORS, buildUnisulmaFlowGraph } from "../src/lib/unisulma-flow-graph";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
  if (!org) throw new Error("Sem organização");

  for (const name of UNISULMA_SECTORS) {
    const exists = await prisma.sector.findFirst({ where: { organizationId: org.id, name } });
    if (!exists) {
      await prisma.sector.create({ data: { organizationId: org.id, name, color: "#001A5E" } });
      console.log("Setor criado:", name);
    }
  }

  const graph = buildUnisulmaFlowGraph();
  const existing = await prisma.flow.findFirst({
    where: { organizationId: org.id, name: UNISULMA_FLOW_NAME },
  });

  if (existing) {
    await prisma.flow.update({
      where: { id: existing.id },
      data: { graph, active: true },
    });
    console.log("Fluxo atualizado:", existing.id);
  } else {
    const flow = await prisma.flow.create({
      data: {
        organizationId: org.id,
        name: UNISULMA_FLOW_NAME,
        active: true,
        graph,
      },
    });
    console.log("Fluxo criado:", flow.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
