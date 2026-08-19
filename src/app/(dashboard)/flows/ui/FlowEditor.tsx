"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Save, Play, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { stepFlow, type FlowGraph, type FlowState } from "@/lib/flow-engine";

// ---- Nós customizados (registrados fora do componente p/ identidade estável) ----

const KIND_STYLE: Record<string, { label: string; color: string }> = {
  start: { label: "Início", color: "#16a34a" },
  texto: { label: "Texto", color: "#2563eb" },
  captura: { label: "Captura", color: "#9333ea" },
  condicao: { label: "Condição", color: "#f59e0b" },
  transferir: { label: "Transferir", color: "#dc2626" },
};

function NodeBox({
  kind,
  summary,
  target = true,
  source = true,
}: {
  kind: string;
  summary?: string;
  target?: boolean;
  source?: boolean;
}) {
  const s = KIND_STYLE[kind] ?? { label: kind, color: "#666" };
  return (
    <div className="rounded-md border bg-white shadow-sm text-xs min-w-[140px]" style={{ borderColor: s.color }}>
      {target && <Handle type="target" position={Position.Top} />}
      <div className="px-2 py-1 font-semibold text-white rounded-t" style={{ backgroundColor: s.color }}>
        {s.label}
      </div>
      <div className="px-2 py-1.5 text-gray-700 truncate max-w-[200px]">{summary || "—"}</div>
      {source && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}

const nodeTypes = {
  start: () => <NodeBox kind="start" summary="Gatilho" target={false} />,
  texto: (p: NodeProps) => <NodeBox kind="texto" summary={String((p.data as { text?: string })?.text ?? "")} />,
  captura: (p: NodeProps) => <NodeBox kind="captura" summary={`→ ${String((p.data as { variable?: string })?.variable ?? "var")}`} />,
  condicao: (p: NodeProps) => (
    <NodeBox kind="condicao" summary={String((p.data as { text?: string })?.text ?? "ramifica por palavra-chave")} />
  ),
  transferir: (p: NodeProps) => <NodeBox kind="transferir" summary={String((p.data as { sector?: string })?.sector ?? "setor")} source={false} />,
};

const PALETTE: Array<{ kind: string; label: string }> = [
  { kind: "texto", label: "Texto" },
  { kind: "captura", label: "Captura" },
  { kind: "condicao", label: "Condição" },
  { kind: "transferir", label: "Transferir" },
];

type FlowRecord = { id: string; name: string; active: boolean; graph: FlowGraph };

export function FlowEditor({ flow }: { flow: FlowRecord }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>((flow.graph.nodes ?? []) as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>((flow.graph.edges ?? []) as Edge[]);
  const [name, setName] = useState(flow.name);
  const [active, setActive] = useState(flow.active);
  const [saving, setSaving] = useState(false);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  function addNode(kind: string) {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    setNodes((nds) => [
      ...nds,
      { id, type: kind, position: { x: 200 + Math.random() * 200, y: 120 + nds.length * 90 }, data: {} } as Node,
    ]);
  }

  function updateNodeData(id: string, patch: Record<string, unknown>) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }
  function updateEdgeKeyword(id: string, keyword: string) {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, label: keyword.split("|")[0] || keyword, data: { ...e.data, keyword } } : e
      )
    );
  }

  const currentGraph = useMemo<FlowGraph>(
    () => ({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })) as FlowGraph["nodes"],
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label as string, data: e.data })) as FlowGraph["edges"],
    }),
    [nodes, edges]
  );

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, active, graph: currentGraph }),
      });
    } finally {
      setSaving(false);
    }
  }

  const node = nodes.find((n) => n.id === selNode);
  const edge = edges.find((e) => e.id === selEdge);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-2 border-b p-2">
        <Button size="sm" variant="ghost" onClick={() => router.push("/flows")}><ArrowLeft className="h-4 w-4" /></Button>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs h-8" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
        </label>
        <div className="ml-auto flex gap-2">
          {PALETTE.map((p) => (
            <Button key={p.kind} size="sm" variant="outline" onClick={() => addNode(p.kind)}>
              <Plus className="h-3 w-3" /> {p.label}
            </Button>
          ))}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => { setSelNode(n.id); setSelEdge(null); }}
            onEdgeClick={(_, e) => { setSelEdge(e.id); setSelNode(null); }}
            onPaneClick={() => { setSelNode(null); setSelEdge(null); }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Inspetor + Simulador */}
        <div className="w-80 border-l overflow-y-auto p-3 space-y-4">
          {node && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">{KIND_STYLE[node.type ?? ""]?.label ?? node.type}</h3>
              {node.type === "texto" && (
                <div className="space-y-1">
                  <Label>Mensagem</Label>
                  <Textarea rows={4} value={String(node.data?.text ?? "")} onChange={(e) => updateNodeData(node.id, { text: e.target.value })} placeholder="Use {{variavel}} para interpolar" />
                </div>
              )}
              {node.type === "captura" && (
                <>
                  <div className="space-y-1">
                    <Label>Pergunta</Label>
                    <Textarea rows={3} value={String(node.data?.text ?? "")} onChange={(e) => updateNodeData(node.id, { text: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Salvar em variável</Label>
                    <Input value={String(node.data?.variable ?? "")} onChange={(e) => updateNodeData(node.id, { variable: e.target.value })} placeholder="ex: nome" />
                  </div>
                </>
              )}
              {node.type === "condicao" && (
                <>
                  <div className="space-y-1">
                    <Label>Resumo no cartão</Label>
                    <Input value={String(node.data?.text ?? "")} onChange={(e) => updateNodeData(node.id, { text: e.target.value })} placeholder="ex: roteia intenção" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ligue este nó a vários destinos. Clique em cada seta e defina a palavra-chave.
                    Use <code>|</code> para várias (ex.: comercial|matrícula). A seta sem palavra-chave é o padrão.
                  </p>
                </>
              )}
              {node.type === "transferir" && (
                <div className="space-y-1">
                  <Label>Setor</Label>
                  <Input value={String(node.data?.sector ?? "")} onChange={(e) => updateNodeData(node.id, { sector: e.target.value })} placeholder="ex: Financeiro" />
                </div>
              )}
              {node.type !== "start" && (
                <Button size="sm" variant="outline" onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== node.id)); setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id)); setSelNode(null); }}>
                  Excluir nó
                </Button>
              )}
            </div>
          )}

          {edge && (
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Conexão</h3>
              <Label>Palavra-chave (condição)</Label>
              <Input
                value={String((edge.data as { keyword?: string } | undefined)?.keyword ?? edge.label ?? "")}
                onChange={(e) => updateEdgeKeyword(edge.id, e.target.value)}
                placeholder="ex: comercial|matrícula — vazio = padrão"
              />
              <Button size="sm" variant="outline" onClick={() => { setEdges((eds) => eds.filter((e) => e.id !== edge.id)); setSelEdge(null); }}>Excluir conexão</Button>
            </div>
          )}

          {!node && !edge && <Simulator graph={currentGraph} />}
        </div>
      </div>
    </div>
  );
}

// ---- Simulador local (roda o motor no navegador) ----
function Simulator({ graph }: { graph: FlowGraph }) {
  const [state, setState] = useState<FlowState | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);

  function push(lines: string[]) {
    if (lines.length) setLog((l) => [...l, ...lines]);
  }

  function start() {
    const r = stepFlow(graph, { nodeId: null, vars: {} }, null);
    setLog(r.messages.map((m) => `🤖 ${m}`).concat(r.actions.map((a) => `➡ transferir: ${a.sector ?? ""}`)));
    setState(r.state);
    setDone(r.done);
  }

  function send() {
    if (!state || !input.trim()) return;
    const text = input.trim();
    push([`🙋 ${text}`]);
    const r = stepFlow(graph, state, text);
    push(r.messages.map((m) => `🤖 ${m}`).concat(r.actions.map((a) => `➡ transferir: ${a.sector ?? ""}`)));
    setState(r.state);
    setDone(r.done);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Simulador</h3>
        <Button size="sm" variant="outline" onClick={start}><Play className="h-3 w-3" /> Iniciar</Button>
      </div>
      <div className="h-64 overflow-y-auto rounded border bg-muted/30 p-2 text-xs space-y-1">
        {log.length === 0 && <p className="text-muted-foreground">Clique em Iniciar para testar o fluxo.</p>}
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {done && <div className="text-muted-foreground italic">— fim —</div>}
      </div>
      {state && !done && (
        <div className="flex gap-1">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Responder..." className="h-8" />
          <Button size="sm" onClick={send}>Enviar</Button>
        </div>
      )}
    </div>
  );
}
