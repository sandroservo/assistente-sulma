/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Grafo do atendimento UNISULMA extraído do chatbot SURI (ago/2026).
 * Tipos do editor: start | texto | captura | condicao | transferir.
 */

export const UNISULMA_FLOW_NAME = "UNISULMA — Atendimento";

const ASK_CPF =
  "Para que eu possa continuar e agilizar seu atendimento com nossa equipe, poderia me informar o motivo do seu contato e o seu CPF?";

const MENU_TEXT = `Menu

Para eu conseguir te ajudar toque em OPÇÕES e selecione o assunto que deseja atendimento 👇

1. Comercial — Matrícula e Valores de Cursos
2. Protocolo — Requerimentos, Pagamentos
3. Coordenação de Cursos — Parecer de Transferência
4. Secretária Acadêmica — Documentação, Rematrícula
5. Financeiro
6. FIES / PROUNI
7. Direção Acadêmica — ANP / Estágio / TCC
8. Biblioteca
9. NCJ`;

const CLINICAS_TEXT =
  "Você está pedindo atendimento nas clínicas-escola da Unisulma. Vou te encaminhar para a equipe informar o contato da clínica certa (fisioterapia, nutrição, psicologia, estética, enfermagem, academia e demais).";

const CLINICAS_KW = [
  "clínica",
  "clinica",
  "clínicas-escola",
  "fisioterapia",
  "nutrição",
  "nutricao",
  "nutricionista",
  "psicologia",
  "psicológico",
  "psicologico",
  "estética",
  "estetica",
  "enfermagem",
  "natação",
  "natacao",
  "vôlei",
  "volei",
  "hidroginástica",
  "hidroginastica",
  "futsal",
  "academia",
  "curativo",
  "sorotepia",
  "ambulatório",
  "ambulatorio",
  "espaço movimenta",
  "espaco movimenta",
].join("|");

type Dept = {
  id: string;
  sector: string;
  label: string;
  keyword: string;
};

const DEPTS: Dept[] = [
  { id: "comercial", sector: "Comercial", label: "Comercial", keyword: "comercial|matrícula|matricula|valores" },
  { id: "protocolo", sector: "Protocolo", label: "Protocolo", keyword: "protocolo|requerimento|pagamentos" },
  {
    id: "coordenacao",
    sector: "Coordenação de Cursos",
    label: "Coordenação",
    keyword: "coordenação|coordenacao|transferência|transferencia",
  },
  {
    id: "secretaria",
    sector: "Secretária Acadêmica",
    label: "Secretaria",
    keyword: "secretária|secretaria|documentação|documentacao|rematrícula|rematricula",
  },
  { id: "financeiro", sector: "Financeiro", label: "Financeiro", keyword: "financeiro" },
  { id: "fies", sector: "FIES / PROUNI", label: "FIES/PROUNI", keyword: "fies|prouni" },
  {
    id: "direcao",
    sector: "Direção Acadêmica",
    label: "Direção",
    keyword: "direção|direcao|anp|estágio|estagio|tcc",
  },
  { id: "biblioteca", sector: "Biblioteca", label: "Biblioteca", keyword: "biblioteca" },
  { id: "ncj", sector: "NCJ", label: "NCJ", keyword: "ncj" },
];

export const UNISULMA_SECTORS = [...DEPTS.map((d) => d.sector), "Clínicas-Escola"];

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  data: Record<string, unknown> = {}
) {
  return { id, type, position: { x, y }, data };
}

function edge(id: string, source: string, target: string, keyword?: string, label?: string) {
  return {
    id,
    source,
    target,
    label: label ?? keyword ?? "",
    data: keyword ? { keyword } : {},
  };
}

/** Layout em árvore: boas-vindas → intenção → setores / clínicas / menu. */
export function buildUnisulmaFlowGraph() {
  const CX = 1180;
  const COL = 240;
  const deptsStartX = 40;

  const nodes = [
    node("start", "start", CX, 0),
    node("t-welcome", "texto", CX, 130, {
      text: "Olá, tudo bem? Seja bem vindo(a) ao atendimento UNISULMA.",
    }),
    node("t-ask", "texto", CX, 270, { text: "Em que podemos ajudar hoje?" }),
    node("cap-intent", "captura", CX, 410, { text: "", variable: "assunto" }),
    node("cond-router", "condicao", CX, 560, { text: "Roteia intenção" }),

    node("t-clinicas", "texto", deptsStartX + 9 * COL, 720, { text: CLINICAS_TEXT }),
    node("xfer-clinicas", "transferir", deptsStartX + 9 * COL, 880, { sector: "Clínicas-Escola" }),

    ...DEPTS.flatMap((d, i) => [
      node(`cap-${d.id}`, "captura", deptsStartX + i * COL, 720, { text: ASK_CPF, variable: "motivoCpf" }),
      node(`xfer-${d.id}`, "transferir", deptsStartX + i * COL, 880, { sector: d.sector }),
    ]),

    node("t-menu", "texto", CX, 1080, { text: MENU_TEXT }),
    node("cap-menu", "captura", CX, 1240, { text: "Toque ou escreva o setor (ex.: Comercial, Financeiro).", variable: "setor" }),
    node("cond-menu", "condicao", CX, 1400, { text: "Menu de setores" }),
  ];

  const edges = [
    edge("e-start", "start", "t-welcome"),
    edge("e-welcome", "t-welcome", "t-ask"),
    edge("e-ask", "t-ask", "cap-intent"),
    edge("e-intent", "cap-intent", "cond-router"),

    edge("e-router-clinicas", "cond-router", "t-clinicas", CLINICAS_KW, "Clínicas-Escola"),
    ...DEPTS.map((d) => edge(`e-router-${d.id}`, "cond-router", `cap-${d.id}`, d.keyword, d.label)),
    edge("e-router-default", "cond-router", "t-menu"),

    edge("e-clinicas", "t-clinicas", "xfer-clinicas"),
    ...DEPTS.map((d) => edge(`e-cap-${d.id}`, `cap-${d.id}`, `xfer-${d.id}`)),

    edge("e-menu-cap", "t-menu", "cap-menu"),
    edge("e-menu-cond", "cap-menu", "cond-menu"),
    ...DEPTS.map((d) => edge(`e-menu-${d.id}`, "cond-menu", `cap-${d.id}`, d.keyword, d.label)),
    edge("e-menu-clinicas", "cond-menu", "t-clinicas", CLINICAS_KW, "Clínicas-Escola"),
  ];

  return { nodes, edges };
}
