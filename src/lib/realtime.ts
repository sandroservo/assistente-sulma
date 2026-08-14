import { EventEmitter } from "events";

/**
 * Pub/sub em memória para realtime do inbox (SSE).
 * Funciona porque o app roda em processo único (`next start`). Se um dia
 * escalar pra múltiplos processos, trocar por Redis pub/sub.
 */

export interface ConversationEvent {
  type: "conversation_update" | "message" | "status" | "pin";
  conversationId?: string;
  leadId?: string;
  at: number;
}

// Singleton robusto a hot-reload / múltiplos imports.
const g = globalThis as unknown as { __viRealtime?: EventEmitter };
const emitter = g.__viRealtime ?? new EventEmitter();
emitter.setMaxListeners(0); // muitas conexões SSE simultâneas
g.__viRealtime = emitter;

const CHANNEL = "conv";

export function emitConversationUpdate(
  payload: Omit<ConversationEvent, "at" | "type"> & { type?: ConversationEvent["type"] }
): void {
  const evt: ConversationEvent = {
    type: payload.type ?? "conversation_update",
    conversationId: payload.conversationId,
    leadId: payload.leadId,
    at: 0, // stamp no consumidor/SSE (Date.now() é permitido em runtime normal do server)
  };
  try {
    emitter.emit(CHANNEL, evt);
  } catch {
    // nunca deixar o realtime quebrar o fluxo principal
  }
}

export function onConversationUpdate(cb: (evt: ConversationEvent) => void): () => void {
  emitter.on(CHANNEL, cb);
  return () => emitter.off(CHANNEL, cb);
}
