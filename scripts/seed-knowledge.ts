/**
 * Ponto de entrada único para a base de conhecimento.
 * Apaga toda a base e insere novamente (todas as orgs).
 * Executar: npx tsx scripts/seed-knowledge.ts
 */

import "dotenv/config";
import { main as runFullSeed } from "./seed-knowledge-full";

runFullSeed().catch((e) => {
  console.error(e);
  process.exit(1);
});
