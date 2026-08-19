/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Motor de execução de fluxos (MVP). Caminha o grafo React Flow nó a nó,
 * pausando em `captura` para aguardar input do contato. Stateless: o estado
 * (nó atual + variáveis) vive fora daqui — no simulador é o request; na
 * produção viverá numa tabela por conversa (resiliente a restart).
 *
 * Tipos de nó suportados: start | texto | captura | condicao | transferir.
 */

export interface FlowNode {
  id: string;
  type?: string;
  data?: {
    text?: string;
    variable?: string;
    sector?: string;
    [k: string]: unknown;
  };
}
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
  data?: { keyword?: string };
}
export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowState {
  nodeId: string | null;      // nó em que parou (captura) — null = início
  awaitingCapture?: boolean;  // true = parado numa captura esperando resposta
  vars: Record<string, string>;
}

export interface FlowStepResult {
  messages: string[];                                   // textos a enviar ao contato
  actions: Array<{ type: "transferir"; sector?: string }>; // efeitos colaterais
  state: FlowState;
  waiting: boolean; // true = aguardando próxima mensagem do contato
  done: boolean;    // true = fluxo terminou
}

const MAX_STEPS = 50; // trava anti-loop

function byId(graph: FlowGraph, id: string): FlowNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/** Próximo nó. Em condição, escolhe a aresta cuja keyword casa com o input. */
function nextTarget(graph: FlowGraph, nodeId: string, input: string, isCondition: boolean): string | null {
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return null;

  if (isCondition) {
    const text = (input || "").toLowerCase();
    const match = outgoing.find((e) => {
      const kw = (e.data?.keyword ?? e.label ?? "").toString().trim().toLowerCase();
      return kw.length > 0 && text.includes(kw);
    });
    if (match) return match.target;
    // fallback: aresta sem keyword (default)
    const def = outgoing.find((e) => !(e.data?.keyword ?? e.label ?? "").toString().trim());
    return (def ?? outgoing[0]).target;
  }

  return outgoing[0].target;
}

function startNode(graph: FlowGraph): FlowNode | undefined {
  return graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0];
}

/**
 * Avança o fluxo consumindo uma mensagem do contato (ou null no início).
 * Retorna o que enviar, o novo estado e se terminou/aguarda.
 */
export function stepFlow(graph: FlowGraph, state: FlowState, input: string | null): FlowStepResult {
  const messages: string[] = [];
  const actions: FlowStepResult["actions"] = [];
  const vars = { ...state.vars };

  // Determina o cursor inicial
  let cursor: string | null;
  if (!state.nodeId) {
    const start = startNode(graph);
    cursor = start ? nextTarget(graph, start.id, input ?? "", false) : null;
  } else if (state.awaitingCapture) {
    // Chegou a resposta da captura: grava a variável e segue.
    const capNode = byId(graph, state.nodeId);
    const varName = capNode?.data?.variable;
    if (varName) vars[varName] = input ?? "";
    cursor = capNode ? nextTarget(graph, capNode.id, input ?? "", false) : null;
  } else {
    cursor = state.nodeId;
  }

  let steps = 0;
  while (cursor && steps < MAX_STEPS) {
    steps++;
    const node = byId(graph, cursor);
    if (!node) break;

    switch (node.type) {
      case "texto":
        if (node.data?.text) messages.push(interpolate(node.data.text, vars));
        cursor = nextTarget(graph, node.id, input ?? "", false);
        break;

      case "captura":
        if (node.data?.text) messages.push(interpolate(node.data.text, vars));
        return {
          messages,
          actions,
          state: { nodeId: node.id, awaitingCapture: true, vars },
          waiting: true,
          done: false,
        };

      case "condicao":
        cursor = nextTarget(graph, node.id, input ?? "", true);
        break;

      case "transferir":
        actions.push({ type: "transferir", sector: node.data?.sector });
        return { messages, actions, state: { nodeId: node.id, vars }, waiting: false, done: true };

      case "start":
      default:
        cursor = nextTarget(graph, node.id, input ?? "", false);
        break;
    }
  }

  return { messages, actions, state: { nodeId: null, vars }, waiting: false, done: true };
}
