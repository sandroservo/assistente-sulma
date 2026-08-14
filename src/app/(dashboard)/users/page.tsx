/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UsersManager } from "./ui/UsersManager";

export default async function UsersPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Apenas OWNER e ADMIN podem gerenciar usuários
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    redirect("/");
  }

  const usersData = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const users = usersData.map((u: typeof usersData[number]) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() || null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6">
      <UsersManager 
        users={users} 
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  );
}
