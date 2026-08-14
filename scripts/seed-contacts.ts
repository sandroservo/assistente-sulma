/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Seed de contatos salvos (clínicas parceiras) para envio via vCard
 * Rodar: npx tsx scripts/seed-contacts.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONTACTS = [
  {
    name: "Amo Vidas - Atendimento",
    phone: "5511999999999",
    organization: "Amo Vidas Clube de Saúde",
    category: "empresa",
  },
  // Adicione mais contatos de clínicas aqui conforme necessário:
  // {
  //   name: "Clínica São Lucas",
  //   phone: "5511888888888",
  //   organization: "Clínica São Lucas",
  //   category: "clinica",
  // },
];

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
  if (!org) {
    console.error("Nenhuma organização encontrada");
    process.exit(1);
  }

  console.log(`Organização: ${org.name} (${org.id})`);

  let created = 0;
  let skipped = 0;

  for (const contact of CONTACTS) {
    const existing = await prisma.savedContact.findFirst({
      where: {
        organizationId: org.id,
        phone: contact.phone,
      },
    });

    if (existing) {
      console.log(`  ⏭️  ${contact.name} já existe`);
      skipped++;
      continue;
    }

    await prisma.savedContact.create({
      data: {
        organizationId: org.id,
        name: contact.name,
        phone: contact.phone,
        organization: contact.organization || null,
        category: contact.category || "clinica",
      },
    });

    console.log(`  ✅ ${contact.name} criado`);
    created++;
  }

  console.log(`\nResultado: ${created} criados, ${skipped} já existiam`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
