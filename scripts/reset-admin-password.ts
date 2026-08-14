/**
 * Reseta a senha do admin para admin123 (útil se esqueceu ou não loga).
 * Execute: npx tsx scripts/reset-admin-password.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@amovidas.com.br";
const NEW_PASSWORD = "admin123";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!user) {
    console.log("❌ Usuário não encontrado:", ADMIN_EMAIL);
    console.log("   Rode antes: npx tsx scripts/seed-admin.ts");
    return;
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { passwordHash, active: true },
  });

  console.log("✅ Senha do admin resetada com sucesso!");
  console.log("   Email:", ADMIN_EMAIL);
  console.log("   Nova senha:", NEW_PASSWORD);
  console.log("   ⚠️  Altere a senha após o login (Configurações ou perfil).");
}

main()
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
