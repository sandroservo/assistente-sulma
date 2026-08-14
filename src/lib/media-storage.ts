/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Utilitário para salvar e servir arquivos de mídia (imagens, áudios, vídeos, documentos)
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "video/mp4": ".mp4",
    "application/pdf": ".pdf",
  };
  return map[mimeType] || ".bin";
}

/**
 * Salva um arquivo de mídia a partir de base64 e retorna o caminho relativo
 * para ser armazenado no campo mediaUrl do Message.
 */
export async function saveMedia(
  base64: string,
  mimeType: string
): Promise<string> {
  if (!existsSync(MEDIA_DIR)) {
    await mkdir(MEDIA_DIR, { recursive: true });
  }

  const ext = getExtension(mimeType);
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(MEDIA_DIR, filename);

  const buffer = Buffer.from(base64, "base64");
  await writeFile(filePath, buffer);

  return `/api/media/${filename}`;
}
