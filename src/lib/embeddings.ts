/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * RAG da base de conhecimento: embeddings OpenAI + busca por similaridade
 * (pgvector) no próprio Postgres (doc §13 — evita mais um serviço na stack).
 * Degrada com elegância: sem chave/erro/coluna vazia → retorna null e o
 * chamador cai no keyword search legado.
 */

import OpenAI from "openai";
import { prisma } from "./prisma";
import { getSystemSettings } from "./settings";

const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims
const MAX_INPUT = 8000; // chars — segura o custo/limite do embed

interface KnowledgeRow {
  id: string;
  organizationId: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number;
  active: boolean;
}

async function getClient(): Promise<OpenAI | null> {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function embedText(text: string): Promise<number[] | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const res = await client.embeddings.create({
      model: EMBED_MODEL,
      input: text.slice(0, MAX_INPUT),
    });
    return res.data[0]?.embedding ?? null;
  } catch (e) {
    console.error("[embeddings] falha ao gerar embedding:", e);
    return null;
  }
}

function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Indexa (ou reindexa) um item de conhecimento. Fire-and-forget seguro. */
export async function indexKnowledge(id: string): Promise<void> {
  const k = await prisma.knowledge.findUnique({
    where: { id },
    select: { title: true, content: true, keywords: true },
  });
  if (!k) return;
  const emb = await embedText(`${k.title}\n${k.keywords ?? ""}\n${k.content}`);
  if (!emb) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "Knowledge" SET embedding = $1::vector WHERE id = $2`,
    toVectorLiteral(emb),
    id
  );
}

/**
 * Busca semântica. Retorna null (não []) quando indisponível, para o chamador
 * distinguir "sem resultado" de "RAG desligado" e cair no fallback keyword.
 */
export async function semanticSearchKnowledge(
  query: string,
  category?: string,
  limit = 5,
  organizationId?: string
): Promise<KnowledgeRow[] | null> {
  const emb = await embedText(query);
  if (!emb) return null;

  const params: unknown[] = [toVectorLiteral(emb)];
  let sql = `SELECT id, "organizationId", category, title, content, keywords, priority, active
             FROM "Knowledge"
             WHERE active = true AND embedding IS NOT NULL`;
  if (organizationId) {
    params.push(organizationId);
    sql += ` AND "organizationId" = $${params.length}`;
  }
  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  // <=> = distância de cosseno (pgvector). Menor = mais similar.
  sql += ` ORDER BY embedding <=> $1::vector LIMIT ${Math.max(1, Math.min(50, Number(limit) || 5))}`;

  try {
    return await prisma.$queryRawUnsafe<KnowledgeRow[]>(sql, ...params);
  } catch (e) {
    // coluna/extensão ausente ou erro de query → fallback keyword
    console.error("[embeddings] busca semântica falhou:", e);
    return null;
  }
}
