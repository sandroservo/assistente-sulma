/**
 * Self-check do spintax. Roda: npx tsx scripts/spintax-check.ts
 */
import assert from "assert";
import { spin } from "../src/lib/spintax";

// escolhe sempre a 1ª opção (rnd=0)
const first = () => 0;
assert.strictEqual(spin("{oi|olá|e aí}, tudo bem?", first), "oi, tudo bem?");

// escolhe sempre a última (rnd~1)
const last = () => 0.999;
assert.strictEqual(spin("{oi|olá|e aí}!", last), "e aí!");

// NÃO mexe em {{nome}} (sem pipe)
assert.strictEqual(spin("Olá {{nome}}, {bem|super}-vindo", first), "Olá {{nome}}, bem-vindo");

// aninhado resolve de dentro pra fora
assert.strictEqual(spin("{a|{b|c}}", last), "c");

// sem spintax, texto intacto
assert.strictEqual(spin("mensagem simples", first), "mensagem simples");

// variabilidade real: 100 execuções produzem >1 saída distinta
const outs = new Set(Array.from({ length: 100 }, () => spin("{a|b|c|d}")));
assert.ok(outs.size > 1, "deve gerar variação");

console.log("OK — spintax self-check passou");
