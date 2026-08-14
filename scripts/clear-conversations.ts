/**
 * Limpa conversas e kanban (leads, mensagens, follow-ups, handoffs, memórias).
 * Executar: npx tsx scripts/clear-conversations.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const msgCount = await prisma.message.deleteMany({});
  const handoffCount = await prisma.handoff.deleteMany({});
  const followUpCount = await prisma.followUp.deleteMany({});
  const convCount = await prisma.conversation.deleteMany({});
  const memoryCount = await prisma.leadMemory.deleteMany({});
  const leadCount = await prisma.lead.deleteMany({});

  console.log("Conversas e kanban limpos:");
  console.log(`  - ${leadCount.count} leads (kanban)`);
  console.log(`  - ${convCount.count} conversas`);
  console.log(`  - ${msgCount.count} mensagens`);
  console.log(`  - ${followUpCount.count} follow-ups`);
  console.log(`  - ${handoffCount.count} handoffs`);
  console.log(`  - ${memoryCount.count} memórias de leads`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
