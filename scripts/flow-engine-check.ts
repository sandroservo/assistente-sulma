/**
 * Self-check do motor de fluxos. Roda: npx tsx scripts/flow-engine-check.ts
 * Cobre: texto -> captura (pausa) -> retoma -> condicao (branch) -> transferir.
 */
import { stepFlow, type FlowGraph, type FlowState } from "../src/lib/flow-engine";
import assert from "assert";

const graph: FlowGraph = {
  nodes: [
    { id: "s", type: "start" },
    { id: "t1", type: "texto", data: { text: "Olá! Bem-vindo." } },
    { id: "cap", type: "captura", data: { text: "Qual seu nome?", variable: "nome" } },
    { id: "t2", type: "texto", data: { text: "Prazer, {{nome}}!" } },
    { id: "cond", type: "condicao" },
    { id: "fin", type: "texto", data: { text: "Financeiro selecionado." } },
    { id: "sup", type: "texto", data: { text: "Suporte selecionado." } },
    { id: "tr", type: "transferir", data: { sector: "Financeiro" } },
  ],
  edges: [
    { id: "e0", source: "s", target: "t1" },
    { id: "e1", source: "t1", target: "cap" },
    { id: "e2", source: "cap", target: "t2" },
    { id: "e3", source: "t2", target: "cond" },
    { id: "e4", source: "cond", target: "fin", data: { keyword: "financeiro" } },
    { id: "e5", source: "cond", target: "sup", data: { keyword: "" } }, // default
    { id: "e6", source: "fin", target: "tr" },
  ],
};

// 1) Início: envia saudação e para na captura pedindo o nome
let state: FlowState = { nodeId: null, vars: {} };
let r = stepFlow(graph, state, null);
assert.deepStrictEqual(r.messages, ["Olá! Bem-vindo.", "Qual seu nome?"], "saudação + prompt captura");
assert.strictEqual(r.waiting, true, "deve aguardar input");
assert.strictEqual(r.done, false);

// 2) Responde nome -> grava var, interpola, cai na condição, casa "financeiro" -> transferir
r = stepFlow(graph, r.state, "Sandro");
// depois da captura: "Prazer, Sandro!" então condição precisa do input; input aqui é "Sandro"
// não casa "financeiro" -> default -> suporte. Corrige expectativa:
assert.strictEqual(r.state.vars.nome, "Sandro", "variável capturada");
assert.ok(r.messages.includes("Prazer, Sandro!"), "interpolação da variável");
assert.ok(r.messages.includes("Suporte selecionado."), "condição sem match -> default (suporte)");
assert.strictEqual(r.done, true, "suporte não tem saída -> termina");

// 3) Caminho financeiro: refaz a captura respondendo com a palavra-chave
r = stepFlow(graph, { nodeId: "cap", awaitingCapture: true, vars: {} }, "quero financeiro");
assert.ok(r.messages.includes("Financeiro selecionado."), "condição casa 'financeiro'");
assert.deepStrictEqual(r.actions, [{ type: "transferir", sector: "Financeiro" }], "transferir p/ Financeiro");
assert.strictEqual(r.done, true);

console.log("OK — flow-engine self-check passou");
