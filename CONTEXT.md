# Assistente Sulma – Contexto do projeto

Contexto para a IA (e para a equipe) saber **onde paramos** no projeto da Sulma.

A Sulma é um **assistente novo** que se implementa neste repositório: painel + WhatsApp + base de conhecimento + handoff humano. O código partiu de uma réplica de arquitetura, mas a identidade do produto é Sulma.

---

## O que é o projeto

- **Nome:** Sulma
- **Stack:** Next.js 16, Prisma (PostgreSQL), Evolution API (WhatsApp), OpenAI (Whisper, Vision, Chat).
- **Função:** Painel para gerenciar a Sulma no WhatsApp: inbox, leads, base de conhecimento, handoff humano, configurações. Webhook recebe mensagens da Evolution e responde com IA.

---

## Onde paramos (últimas entregas)

1. **Suporte a áudio** – Mensagens de áudio são transcritas (Whisper) no webhook; o texto é usado como mensagem do usuário. Mensagem salva com `type: "audio"`.
2. **Suporte a imagem** – Imagens são descritas (Vision / gpt-4o-mini) no webhook; descrição (e legenda) viram contexto para a IA. Mensagem salva com `type: "image"`.
3. **Human in the loop** – Se a mensagem é `fromMe` (atendente enviou pelo WhatsApp), o lead passa para `ownerType: "human"` e a Sulma para de responder até alguém clicar em "Devolver ao Bot" no painel.
4. **Lista de exceção** – Em Configurações → aba **Exceções**: números para a Sulma **não** responder (ex.: pessoas da empresa). Modelo `ExcludedContact`, API `/api/excluded-contacts`, webhook verifica antes de responder.
5. **Correção form aninhado** – Em ExcludedContactsCard, o `<form>` interno foi trocado por `<div>` + botão `type="button"` para evitar form dentro de form (hydration error).
6. **Rebrand** – Identidade do produto migrada para Sulma (UI, prompts, scripts, docs).

---

## Integração Amo Vidas (cobrança)

Quando o lead pergunta sobre **clientes vencidos**, **cobranças em atraso** ou **inadimplentes**, a Sulma consulta em tempo real a API do sistema Amo Vidas (`GET /api/agent/cobranca/overdue`) e inclui os dados no contexto. Requer `AMOVIDAS_API_URL` e `AMOVIDAS_AGENT_TOKEN` no `.env`.

---

## Pendências / próximos passos (lista do fluxo)

- **Resumo da conversa** – Gerar e salvar resumo no lead (campos `summary` / `notes` já existem no modelo Lead).
- **Base de conhecimento enriquecida** – Tabela de dependentes, exemplos de valor (ex.: consultas).

---

## Atualizações da Sulma (base de conhecimento)

Para **atualizar a base de conhecimento** da Sulma (planos, check-ups, regras, links, parceiros):

```bash
npm run atualizar-sulma
# ou
npm run seed:knowledge
```

Isso executa `scripts/seed-knowledge.ts` → `seed-knowledge-full.ts`: **apaga** toda a base atual e **insere** de novo os itens definidos em `KNOWLEDGE_DATA`. Use após alterar preços, check-ups, links ou parceiros em `scripts/seed-knowledge-full.ts`.

**Arquivo a editar para mudar o que a Sulma sabe:** `scripts/seed-knowledge-full.ts`.

---

## Arquivos importantes

| Área | Caminho |
|------|---------|
| Webhook Evolution | `src/app/api/webhooks/evolution/route.ts` |
| IA (prompt, conhecimento, status do lead) | `src/lib/ai.ts` |
| Amo Vidas API (cobrança vencidos) | `src/lib/amovidas-api.ts` |
| Mídia (Whisper, Vision) | `src/lib/media.ts` |
| Evolution (envio, base64 mídia) | `src/lib/evolution.ts` |
| Lista de exceção (API) | `src/app/api/excluded-contacts/` |
| Lista de exceção (UI) | `src/app/(dashboard)/settings/ui/ExcludedContactsCard.tsx` |
| Schema Prisma | `prisma/schema.prisma` |
| Base de conhecimento (seed) | `scripts/seed-knowledge-full.ts` |
| Atualizar base da Sulma | `npm run atualizar-sulma` ou `npm run seed:knowledge` |

---

## Documentação extra

- `docs/FLUXO-N8N-ANALISE.md` – Análise dos fluxos n8n e o que foi aproveitado.
- `docs/MELHORIAS-CODIGO.md` – Melhorias de segurança e multitenancy.
- `agent/` – Textos de referência (club de desconto, informações Amo Vidas, systemprompt).

---

*Atualize este arquivo quando fizer entregas ou mudar prioridades.*
