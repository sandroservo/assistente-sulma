/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Detecção de automação no outro lado por TIMING: conta trocas "out → in"
 * consecutivas em janela curta (bot responde rápido e constante). Puro/testável.
 */

export interface TurnMsg {
  direction: string; // "in" | "out"
  createdAt: Date;
}

/**
 * Maior sequência de trocas rápidas consecutivas nas mensagens (ordem cronológica).
 * Uma "troca rápida" = mensagem `in` que chega até `rapidMs` depois do nosso `out`.
 */
export function countRapidTurns(msgs: TurnMsg[], rapidMs: number): number {
  let streak = 0;
  let max = 0;
  let lastOutAt: Date | null = null;
  for (const m of msgs) {
    if (m.direction === "out") {
      lastOutAt = m.createdAt;
    } else {
      if (lastOutAt && m.createdAt.getTime() - lastOutAt.getTime() <= rapidMs) {
        streak++;
        max = Math.max(max, streak);
      } else {
        streak = 0;
      }
      lastOutAt = null; // cada out conta pra uma troca só
    }
  }
  return max;
}
