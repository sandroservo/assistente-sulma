/**
 * Apaga todas as conversas (e mensagens) de um lead pelo telefone.
 * Executar: npx tsx scripts/delete-lead-conversations.ts 99991216206
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function main() {
  const phoneArg = process.argv[2];
  if (!phoneArg) {
    console.error("Uso: npx tsx scripts/delete-lead-conversations.ts <telefone>");
    console.error("Exemplo: npx tsx scripts/delete-lead-conversations.ts 99991216206");
    process.exit(1);
  }

  const digits = normalizePhone(phoneArg);
  const with55 = digits.startsWith("55") ? digits : `55${digits}`;
  const without55 = digits.replace(/^55/, "");

  // Busca lead por telefone (vários formatos possíveis no banco)
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { phone: digits },
        { phone: with55 },
        { phone: without55 },
        { phone: { contains: "99991216206" } }, // fallback: contém o número
      ],
    },
    include: { _count: { select: { conversations: true } } },
  });

  if (!lead) {
    console.error(`Lead não encontrado com telefone: ${phoneArg}`);
    console.error("Dica: telefone no banco pode estar com 55, espaços ou traços. Liste leads com: npx tsx -e \"require('./src/lib/prisma').prisma.lead.findMany({take:5,select:{phone:true,name:true}}).then(r=>console.log(r))\"");
    process.exit(1);
  }

  const convCount = lead._count.conversations;

  // Remove mensagens, handoffs e followups das conversas do lead; depois remove as conversas
  const conversations = await prisma.conversation.findMany({
    where: { leadId: lead.id },
    select: { id: true },
  });
  const convIds = conversations.map((c) => c.id);

  const msgCount = await prisma.message.deleteMany({
    where: { conversationId: { in: convIds } },
  });
  await prisma.handoff.deleteMany({
    where: { conversationId: { in: convIds } },
  });
  await prisma.followUp.deleteMany({
    where: { conversationId: { in: convIds } },
  });
  const deletedConvs = await prisma.conversation.deleteMany({
    where: { leadId: lead.id },
  });

  console.log(`Lead: ${lead.name || lead.pushName || lead.phone} (${lead.phone})`);
  console.log(`  ${msgCount.count} mensagens apagadas`);
  console.log(`  ${deletedConvs.count} conversas apagadas`);
  console.log("Concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
