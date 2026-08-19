/**
 * Espelha chats recentes da Evolution no inbox da Sulma.
 * A Evolution às vezes guarda a mensagem e não dispara o webhook (LID / falha de POST).
 */

import { getEvolutionCredentials, resolvePanelInstance, evolutionApiRoot } from "@/lib/evolution-credentials";

const g = globalThis as unknown as { __sulmaInboxSyncAt?: number; __sulmaInboxSyncing?: Promise<number> };

export async function syncEvolutionInbox(): Promise<number> {
  const now = Date.now();
  if (g.__sulmaInboxSyncing) return g.__sulmaInboxSyncing;
  if (g.__sulmaInboxSyncAt && now - g.__sulmaInboxSyncAt < 8_000) return 0;

  g.__sulmaInboxSyncing = (async () => {
    try {
      const panel = await resolvePanelInstance();
      if (!panel) return 0;
      const creds = await getEvolutionCredentials(panel.organizationId, panel.token);
      if (!creds.baseUrl || !creds.token) return 0;

      const root = evolutionApiRoot(creds.baseUrl);
      const res = await fetch(`${root}/chat/findChats/${panel.instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: creds.token,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error("[Evolution sync] findChats", res.status);
        return 0;
      }

      const chats = (await res.json().catch(() => [])) as Array<{
        updatedAt?: string;
        lastMessage?: Record<string, unknown>;
      }>;
      if (!Array.isArray(chats)) return 0;

      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const liveWindow = 3 * 60 * 1000;
      const port = process.env.PORT || "3000";
      const webhookUrl = `http://127.0.0.1:${port}/api/webhooks/evolution`;

      let imported = 0;
      for (const chat of chats) {
        const last = chat.lastMessage;
        if (!last || typeof last !== "object") continue;
        const key = last.key as { fromMe?: boolean } | undefined;
        if (key?.fromMe === true) continue;
        const updated = chat.updatedAt ? new Date(chat.updatedAt).getTime() : Date.now();
        if (updated < cutoff) continue;

        const payload = {
          event: "messages.upsert",
          instance: panel.instanceName,
          data: last,
          sulmaSkipBot: Date.now() - updated > liveWindow,
        };
        try {
          const wr = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20000),
          });
          if (wr.ok) imported++;
        } catch (error) {
          console.error("[Evolution sync] ingest falhou:", error);
        }
      }

      g.__sulmaInboxSyncAt = Date.now();
      if (imported) console.log("[Evolution sync] importadas", imported, "conversas recentes");
      return imported;
    } finally {
      g.__sulmaInboxSyncing = undefined;
    }
  })();

  return g.__sulmaInboxSyncing;
}
