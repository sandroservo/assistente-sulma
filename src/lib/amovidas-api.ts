/**
 * Cliente para APIs do sistema Amo Vidas (cobrança, etc.)
 * Usado pela Sulma para consultar dados em tempo real.
 *
 * Env: AMOVIDAS_API_URL, AMOVIDAS_AGENT_TOKEN
 */

const BASE = process.env.AMOVIDAS_API_URL || "https://amovidas.com.br";
const TOKEN = process.env.AMOVIDAS_AGENT_TOKEN;

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

export function hasCobrancaToken(): boolean {
  return !!TOKEN;
}

export interface DevedorInfo {
  found: boolean;
  userId?: number;
  name?: string;
  debtTotal?: number;
  chargesCount?: number;
  situation?: string;
  daysOverdue?: number;
  planTitle?: string | null;
  lastPaymentLink?: string | null;
}

// ---------- Campanha promocional ----------
const PROMO_BASE = process.env.PROMO_API_URL || "https://campanhas.amovidas.com.br";

export interface LeadCampanhaInfo {
  found: boolean;
  role?: "indicador" | "indicado";
  campanha?: string;
  indicadorName?: string;
  indicadoName?: string | null;
  examesGanhos?: number;
  sorteioInfo?: string;
  premioInfo?: string;
}

export function hasCampanhaToken(): boolean {
  return !!TOKEN && !!PROMO_BASE;
}

/** Verifica se o telefone é de um lead da campanha (indicador ou indicado). */
export async function buscarLeadCampanhaPorTelefone(phone: string): Promise<LeadCampanhaInfo> {
  if (!TOKEN || !phone) return { found: false };
  try {
    const res = await fetch(`${PROMO_BASE}/api/agent/campanha/by-phone?phone=${encodeURIComponent(phone)}`, { headers: headers() });
    if (!res.ok) return { found: false };
    return (await res.json()) as LeadCampanhaInfo;
  } catch {
    return { found: false };
  }
}

/** Verifica se o telefone é de um cliente devedor (agente Hermes). */
export async function buscarDevedorPorTelefone(phone: string): Promise<DevedorInfo> {
  if (!TOKEN || !phone) return { found: false };
  try {
    const res = await fetch(`${BASE}/api/agent/cobranca/by-phone?phone=${encodeURIComponent(phone)}`, { headers: headers() });
    if (!res.ok) return { found: false };
    return (await res.json()) as DevedorInfo;
  } catch {
    return { found: false };
  }
}

export interface ClienteVencido {
  customerName: string;
  value: number;
  daysOverdue: number;
  dueDate: string;
  phone: string | null;
  userId: number | null;
  email?: string | null;
  asaasCustomerId?: string | null;
  asaasPaymentId?: string | null;
  status?: string | null;
  lastNote?: string | null;
  lastContactAt?: string | null;
  chargesCount?: number;
}

export interface CobrancaFiltros {
  days?: string; // '1-7' | '8-30' | '31+' | 'all'
  minValue?: string | number;
  search?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}

export interface ObservacaoCobranca {
  id: number;
  note: string;
  status: string;
  author_name: string | null;
  author_source: string;
  created_at: string;
}

export async function listarClientesVencidos(filtros: CobrancaFiltros = {}): Promise<{
  ok: boolean;
  clients?: ClienteVencido[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
}> {
  if (!TOKEN) {
    return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  }
  try {
    const params = new URLSearchParams();
    if (filtros.days && filtros.days !== "all") params.set("days", filtros.days);
    if (filtros.minValue) params.set("minValue", String(filtros.minValue));
    if (filtros.search) params.set("search", filtros.search);
    if (filtros.status && filtros.status !== "all") params.set("status", filtros.status);
    if (filtros.page) params.set("page", String(filtros.page));
    if (filtros.limit) params.set("limit", String(filtros.limit));
    const qs = params.toString();

    const res = await fetch(`${BASE}/api/agent/cobranca/overdue${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    const d = data as {
      clients?: ClienteVencido[];
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
    };
    return {
      ok: true,
      clients: d.clients || [],
      total: d.total ?? 0,
      page: d.page ?? 1,
      limit: d.limit ?? 0,
      totalPages: d.totalPages ?? 1,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Lista observações de cobrança de um cliente. */
export async function listarObservacoesCobranca(params: {
  userId?: number | null;
  asaasCustomerId?: string | null;
}): Promise<{ ok: boolean; notes?: ObservacaoCobranca[]; status?: string | null; error?: string }> {
  if (!TOKEN) return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  try {
    const qs = new URLSearchParams();
    if (params.userId) qs.set("user_id", String(params.userId));
    else if (params.asaasCustomerId) qs.set("asaas_customer_id", params.asaasCustomerId);

    const res = await fetch(`${BASE}/api/agent/cobranca/note?${qs}`, {
      method: "GET",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      notes: (data as { notes?: ObservacaoCobranca[] }).notes || [],
      status: (data as { status?: string | null }).status ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Registra uma observação de contato de cobrança. */
export async function salvarObservacaoCobranca(payload: {
  userId?: number | null;
  asaasCustomerId?: string | null;
  asaasPaymentId?: string | null;
  note: string;
  status?: string;
  authorName?: string | null;
}): Promise<{ ok: boolean; note?: ObservacaoCobranca; error?: string }> {
  if (!TOKEN) return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  try {
    const res = await fetch(`${BASE}/api/agent/cobranca/note`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        user_id: payload.userId ?? null,
        asaas_customer_id: payload.asaasCustomerId ?? null,
        asaas_payment_id: payload.asaasPaymentId ?? null,
        note: payload.note,
        status: payload.status,
        author_name: payload.authorName ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return { ok: true, note: (data as { note?: ObservacaoCobranca }).note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Dispara mensagem de cobrança no WhatsApp do cliente (via sistema). */
export async function enviarCobranca(payload: {
  userId?: number | null;
  asaasCustomerId?: string | null;
  message?: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!TOKEN) return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  try {
    const body: Record<string, unknown> = {
      user_id: payload.userId ?? null,
      asaas_customer_id: payload.asaasCustomerId ?? null,
    };
    if (payload.message) body.message = payload.message;
    const res = await fetch(`${BASE}/api/agent/cobranca/send`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(raw); } catch { /* resposta não-JSON */ }
    // sistema usa success/message; mapeamos p/ ok/error/message.
    const okFlag = res.ok && (data.ok === true || data.success === true || data.success === undefined);
    if (!okFlag) {
      const err =
        (data.error as string) ||
        (data.message as string) ||
        (raw ? raw.slice(0, 200) : `HTTP ${res.status}`);
      console.error("[enviarCobranca] falha:", res.status, err);
      return { ok: false, error: err };
    }
    return { ok: true, message: (data.message as string) };
  } catch (e) {
    console.error("[enviarCobranca] exceção:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ReminderTemplate {
  id: number;
  name: string;
  situation: string;
  body: string;
}

/** Busca modelos de lembrete ativos por situação. */
export async function fetchReminderTemplates(situation?: string): Promise<{
  ok: boolean;
  templates?: ReminderTemplate[];
  error?: string;
}> {
  if (!TOKEN) return { ok: false, error: "AMOVIDAS_AGENT_TOKEN não configurado" };
  try {
    const params = new URLSearchParams();
    if (situation) params.set("situation", situation);
    const res = await fetch(`${BASE}/api/agent/reminder-templates?${params}`, {
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return { ok: true, templates: (data as { templates?: ReminderTemplate[] }).templates || [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
