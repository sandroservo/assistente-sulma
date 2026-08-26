/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Spintax: varia a mensagem por destinatário pra reduzir o flag de "mensagem
 * idêntica em massa" (causa comum de bloqueio). Sintaxe: {opção1|opção2|opção3}.
 * Só age em chaves COM `|` — não colide com `{{variavel}}` do template.
 */

// Só casa chaves que contêm pelo menos um `|` (uma escolha), sem chaves aninhadas.
const CHOICE_RE = /\{([^{}]*\|[^{}]*)\}/;

/** Resolve cada `{a|b|c}` por uma opção aleatória. Aninhamento resolvido de dentro pra fora. */
export function spin(template: string, rnd: () => number = Math.random): string {
  let s = template;
  let guard = 0;
  while (CHOICE_RE.test(s) && guard++ < 200) {
    s = s.replace(CHOICE_RE, (_m, body: string) => {
      const opts = body.split("|");
      return opts[Math.floor(rnd() * opts.length)] ?? "";
    });
  }
  return s;
}
