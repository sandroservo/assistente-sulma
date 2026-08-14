/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Script para criar usuário admin inicial
 * Execute: npx tsx scripts/seed-admin.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "admin@amovidas.com.br";
  const adminPassword = "admin123"; // Altere após o primeiro login!
  const organizationName = "Amo Vidas";

  // Verifica se já existe
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingUser) {
    console.log("❌ Usuário admin já existe:", adminEmail);
    return;
  }

  // Cria ou busca organização
  let organization = await prisma.organization.findFirst({
    where: { slug: "amo-vidas" },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: "amo-vidas",
        plan: "pro",
        maxUsers: 10,
        maxInstances: 5,
      },
    });
    console.log("✅ Organização criada:", organizationName);
  }

  // Cria usuário admin
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Administrador",
      email: adminEmail,
      passwordHash,
      role: "OWNER",
    },
  });

  console.log("✅ Usuário admin criado com sucesso!");
  console.log("   Email:", adminEmail);
  console.log("   Senha:", adminPassword);
  console.log("   ⚠️  Altere a senha após o primeiro login!");
}

main()
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
