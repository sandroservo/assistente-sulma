/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { prisma } from "@/lib/prisma";
import { getSessionOrRedirect } from "@/lib/auth";
import { KnowledgeManager } from "./ui/KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await getSessionOrRedirect();

  const knowledgeItems = await prisma.knowledge.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ category: "asc" }, { priority: "desc" }, { title: "asc" }],
  });

  const categories = [...new Set(knowledgeItems.map((item: (typeof knowledgeItems)[number]) => item.category))] as string[];

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-4 md:space-y-6 h-full overflow-auto">
      <KnowledgeManager 
        initialItems={knowledgeItems} 
        categories={categories}
      />
    </div>
  );
}
