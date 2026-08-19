/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Leitura e modelo Excel/CSV para importar contatos.
 */

import * as XLSX from "xlsx";

export const CONTACT_IMPORT_HEADERS = [
  "nome",
  "telefone",
  "email",
  "categoria",
  "cidade",
  "observacoes",
  "tags",
] as const;

export type ImportedContactRow = {
  row: number;
  name: string;
  phone: string;
  email: string;
  category: string;
  city: string;
  notes: string;
  tags: string[];
};

const HEADER_ALIASES: Record<string, (typeof CONTACT_IMPORT_HEADERS)[number]> = {
  nome: "nome",
  name: "nome",
  telefone: "telefone",
  phone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  email: "email",
  "e-mail": "email",
  categoria: "categoria",
  category: "categoria",
  cidade: "cidade",
  city: "cidade",
  observacoes: "observacoes",
  observações: "observacoes",
  notes: "observacoes",
  obs: "observacoes",
  tags: "tags",
  etiquetas: "tags",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normHeader(raw: string): string {
  return stripAccents(String(raw || "").trim().toLowerCase()).replace(/\s+/g, " ");
}

export function cellToString(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/** Normaliza telefone BR: só dígitos, prefixo 55 quando for DDD local. */
export function normalizeImportPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(0, 13);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 15);
}

export function parseTagList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function mapHeaderRow(cells: unknown[]): Map<(typeof CONTACT_IMPORT_HEADERS)[number], number> {
  const map = new Map<(typeof CONTACT_IMPORT_HEADERS)[number], number>();
  cells.forEach((cell, i) => {
    const key = HEADER_ALIASES[normHeader(cellToString(cell))];
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

export function parseContactWorkbook(buffer: Buffer): ImportedContactRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() !== "instruções" && n.toLowerCase() !== "instrucoes")
    ?? wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (rows.length < 2) return [];

  const headerMap = mapHeaderRow(rows[0] ?? []);
  if (!headerMap.has("nome") || !headerMap.has("telefone")) {
    throw new Error("A planilha precisa das colunas nome e telefone (veja o modelo).");
  }

  const out: ImportedContactRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i] ?? [];
    const name = cellToString(line[headerMap.get("nome") ?? -1]);
    const phoneRaw = cellToString(line[headerMap.get("telefone") ?? -1]);
    if (!name && !phoneRaw) continue;
    out.push({
      row: i + 1,
      name,
      phone: phoneRaw,
      email: cellToString(line[headerMap.get("email") ?? -1]),
      category: cellToString(line[headerMap.get("categoria") ?? -1]) || "geral",
      city: cellToString(line[headerMap.get("cidade") ?? -1]),
      notes: cellToString(line[headerMap.get("observacoes") ?? -1]),
      tags: parseTagList(cellToString(line[headerMap.get("tags") ?? -1])),
    });
  }
  return out;
}

export function buildContactTemplateXlsx(): Buffer {
  const wb = XLSX.utils.book_new();

  const contacts = XLSX.utils.aoa_to_sheet([
    [...CONTACT_IMPORT_HEADERS],
    [
      "Maria Silva",
      "5598984003597",
      "maria@email.com",
      "geral",
      "São Luís",
      "Interessada em Medicina",
      "vestibular, medicina",
    ],
    [
      "João Santos",
      "5598999999999",
      "",
      "geral",
      "",
      "",
      "",
    ],
  ]);
  contacts["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, contacts, "Contatos");

  const help = XLSX.utils.aoa_to_sheet([
    ["Como importar contatos na Sulma"],
    [""],
    ["1. Preencha a aba Contatos. Não apague nem renomeie a primeira linha (nomes das colunas)."],
    ["2. Colunas obrigatórias: nome e telefone."],
    ["3. Telefone com DDD. Pode ser (98) 99999-9999 ou 5598999999999. O sistema completa o 55 do Brasil."],
    ["4. Digite o telefone como texto para o Excel não cortar o número."],
    ["5. categoria: geral (ou outro rótulo livre)."],
    ["6. tags: várias palavras separadas por vírgula (ex.: vestibular, medicina)."],
    ["7. Apague as linhas de exemplo antes de importar os dados reais."],
    ["8. Em Contatos, clique em Importar Excel e envie este arquivo (.xlsx ou .csv)."],
    [""],
    ["Colunas"],
    ["nome", "Obrigatório"],
    ["telefone", "Obrigatório"],
    ["email", "Opcional"],
    ["categoria", "Opcional — padrão: geral"],
    ["cidade", "Opcional"],
    ["observacoes", "Opcional"],
    ["tags", "Opcional — separadas por vírgula"],
  ]);
  help["!cols"] = [{ wch: 18 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, help, "Instruções");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
