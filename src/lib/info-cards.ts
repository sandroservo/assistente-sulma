/**
 * Cards informativos enviados no chat.
 * Arquivos em data/cards/; cadastro no banco.
 */

import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const CARDS_DIR = path.join(process.cwd(), "data", "cards");
const PUBLIC_CARDS_DIR = path.join(process.cwd(), "public", "cards");

const DEFAULT_LABELS: Record<string, string> = {
  "planos.jpeg": "Planos",
  "planos_e_seu_dependentes.jpeg": "Planos e Dependentes",
  "checkups.jpeg": "Check-ups",
  "especialidades_dentro_dos_palnos.jpeg": "Especialidades",
  "exame_plano_ cobertura_ total.jpeg": "Exames - Cobertura Total",
  "exame_plano_ especializado.jpeg": "Exames - Especializado",
  "exame_plano_ rotina.jpeg": "Exames - Rotina",
};

export function infoCardFileUrl(filename: string): string {
  return `/api/info-cards/file/${encodeURIComponent(filename)}`;
}

export function cardsDir(): string {
  return CARDS_DIR;
}

function titleFromFilename(filename: string): string {
  if (DEFAULT_LABELS[filename]) return DEFAULT_LABELS[filename];
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureCardsDir() {
  if (!existsSync(CARDS_DIR)) {
    await mkdir(CARDS_DIR, { recursive: true });
  }
}

export async function seedPublicCardsIfEmpty(organizationId: string): Promise<void> {
  const count = await prisma.infoCard.count({ where: { organizationId } });
  if (count > 0 || !existsSync(PUBLIC_CARDS_DIR)) return;

  await ensureCardsDir();
  const files = readdirSync(PUBLIC_CARDS_DIR).filter((f) =>
    /\.(jpe?g|png|webp|gif)$/i.test(f)
  );

  for (const file of files) {
    const src = path.join(PUBLIC_CARDS_DIR, file);
    const destName = `${randomUUID()}${path.extname(file).toLowerCase()}`;
    const dest = path.join(CARDS_DIR, destName);
    await copyFile(src, dest);
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
    await prisma.infoCard.create({
      data: {
        organizationId,
        title: titleFromFilename(file),
        filename: destName,
        mimeType: mime,
      },
    });
  }
}

export async function listInfoCards(organizationId: string) {
  await seedPublicCardsIfEmpty(organizationId);
  const cards = await prisma.infoCard.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return cards.map((c) => ({
    id: c.id,
    title: c.title,
    filename: c.filename,
    mimeType: c.mimeType,
    imageUrl: infoCardFileUrl(c.filename),
    createdAt: c.createdAt,
  }));
}

export async function saveInfoCardFile(base64: string, mimeType: string): Promise<string> {
  await ensureCardsDir();
  const ext =
    mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : mimeType === "image/gif"
          ? ".gif"
          : ".jpg";
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(CARDS_DIR, filename), Buffer.from(base64, "base64"));
  return filename;
}

export async function deleteInfoCardFile(filename: string): Promise<void> {
  const safe = path.basename(filename);
  const filePath = path.join(CARDS_DIR, safe);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
