/**
 * Mensagens de erro de disparo para a tela (sem JSON da Evolution).
 */

export function classifySendError(message: string): "invalid_number" | "blocked" | "transient" | "unknown" {
  const t = String(message || "").toLowerCase();
  if (
    t.includes("exists") ||
    t.includes("not a whatsapp") ||
    t.includes("número inválido") ||
    t.includes("invalid number")
  ) {
    return "invalid_number";
  }
  if (
    t.includes("blocked") ||
    t.includes("banned") ||
    t.includes("forbidden") ||
    t.includes("403") ||
    t.includes("401") ||
    t.includes("restricted") ||
    t.includes("temporarily")
  ) {
    return "blocked";
  }
  if (
    t.includes("503") ||
    t.includes("timeout") ||
    t.includes("econn") ||
    t.includes("closed") ||
    t.includes("disconnect")
  ) {
    return "transient";
  }
  return "unknown";
}

export function formatSendError(message: string): string {
  const t = String(message || "").toLowerCase();
  if (
    (t.includes("exists") && t.includes("false")) ||
    t.includes("not a whatsapp") ||
    t.includes("não é um whatsapp")
  ) {
    return "Este número não tem WhatsApp.";
  }
  if (t.includes("número inválido") || t.includes("invalid number")) {
    return "Número inválido ou incompleto.";
  }
  if (
    t.includes("connection closed") ||
    t.includes("session closed") ||
    (t.includes("closed") && t.includes("connection"))
  ) {
    return "WhatsApp desconectou. Reconecte a instância e tente de novo.";
  }
  if (t.includes("restricted") || t.includes("temporarily") || t.includes("banned")) {
    return "WhatsApp restringiu este número por hoje. Tente amanhã no horário comercial.";
  }
  if (t.includes("blocked") || t.includes("banned") || t.includes("forbidden")) {
    return "Não foi possível enviar para este número.";
  }
  if (
    t.includes("timeout") ||
    t.includes("503") ||
    t.includes("econn") ||
    t.includes("disconnect") ||
    t.includes("not connected")
  ) {
    return "Falha temporária de conexão. Reconecte o WhatsApp se o problema continuar.";
  }
  if (t.includes("401") || t.includes("403")) {
    return "Instância sem permissão para enviar. Reconecte o WhatsApp.";
  }
  if (
    t.includes("evolution") ||
    t.includes("bad request") ||
    t.includes("{") ||
    t.includes("status\":")
  ) {
    return "Não foi possível entregar esta mensagem.";
  }
  const clean = String(message || "").trim();
  if (clean.length > 90) return "Não foi possível entregar esta mensagem.";
  return clean || "Não foi possível entregar esta mensagem.";
}
