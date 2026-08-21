type ContactRow = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  errorMsg: string | null;
  sentAt: Date | string | null;
};

type RunRow = {
  id: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  consecutiveFailures?: number;
  pauseReason: string | null;
  waitUntil: Date | string | null;
  waitReason: string | null;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  campaign: { id: string; name: string; message: string };
  contacts: ContactRow[];
};

function rankStatus(s: string) {
  if (s === "sent" || s === "delivered" || s === "read") return 0;
  if (s === "sending") return 1;
  if (s === "pending") return 2;
  if (s === "skipped") return 3;
  return 4;
}

function sortContacts(contacts: ContactRow[]) {
  return [...contacts].sort((a, b) => {
    const r = rankStatus(a.status) - rankStatus(b.status);
    if (r !== 0) return r;
    const at = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const bt = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return bt - at;
  });
}

export function presentBroadcastRun(run: RunRow, extra?: { ownerName?: string | null }) {
  const contacts = sortContacts(run.contacts);
  const processed = run.sent + run.failed + run.skipped;
  const remaining = Math.max(0, run.total - processed);
  let etaSeconds: number | null = null;
  if (processed > 0 && remaining > 0) {
    const elapsed = Date.now() - new Date(run.startedAt).getTime();
    etaSeconds = Math.round((remaining * (elapsed / processed)) / 1000);
  }
  return {
    id: run.id,
    status: run.status,
    total: run.total,
    sent: run.sent,
    failed: run.failed,
    skipped: run.skipped,
    consecutiveFailures: run.consecutiveFailures ?? 0,
    pauseReason: run.pauseReason,
    waitUntil: run.waitUntil,
    waitReason: run.waitReason,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    campaignId: run.campaign.id,
    campaignName: run.campaign.name,
    messagePreview: run.campaign.message.slice(0, 140),
    etaSeconds,
    ownerName: extra?.ownerName ?? null,
    contacts,
  };
}

export function mergeBroadcastRuns(runs: RunRow[], ownerName?: string | null) {
  if (runs.length === 0) return null;
  if (runs.length === 1) return presentBroadcastRun(runs[0], { ownerName });

  const names = [...new Set(runs.map((r) => r.campaign.name))];
  const primary =
    runs.find((r) => r.status === "PAUSED") ||
    runs.find((r) => r.status === "RUNNING") ||
    runs[0];
  const contacts = sortContacts(runs.flatMap((r) => r.contacts));
  const total = runs.reduce((s, r) => s + r.total, 0);
  const sent = runs.reduce((s, r) => s + r.sent, 0);
  const failed = runs.reduce((s, r) => s + r.failed, 0);
  const skipped = runs.reduce((s, r) => s + r.skipped, 0);
  const processed = sent + failed + skipped;
  const remaining = Math.max(0, total - processed);
  const oldest = runs.reduce((a, b) =>
    new Date(a.startedAt).getTime() < new Date(b.startedAt).getTime() ? a : b
  );
  let etaSeconds: number | null = null;
  if (processed > 0 && remaining > 0) {
    const elapsed = Date.now() - new Date(oldest.startedAt).getTime();
    etaSeconds = Math.round((remaining * (elapsed / processed)) / 1000);
  }
  const waiting = runs.find((r) => r.waitUntil && new Date(r.waitUntil).getTime() > Date.now());
  return {
    id: primary.id,
    status: primary.status,
    total,
    sent,
    failed,
    skipped,
    consecutiveFailures: Math.max(...runs.map((r) => r.consecutiveFailures ?? 0)),
    pauseReason: primary.pauseReason,
    waitUntil: waiting?.waitUntil ?? primary.waitUntil,
    waitReason: waiting?.waitReason ?? primary.waitReason,
    startedAt: oldest.startedAt,
    finishedAt: primary.finishedAt,
    campaignId: primary.campaign.id,
    campaignName: names.length > 1 ? `Sua fila · ${names.length} campanhas` : names[0],
    messagePreview: primary.campaign.message.slice(0, 140),
    etaSeconds,
    ownerName: ownerName ?? null,
    contacts,
  };
}
