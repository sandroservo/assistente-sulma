# Sulma

Assistente Sulma: painel de atendimento no WhatsApp com IA, inbox, leads, base de conhecimento e handoff humano.

## Stack

Next.js 16, Prisma (PostgreSQL), Evolution API, OpenAI.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts úteis

| Comando | Função |
|---------|--------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run atualizar-sulma` | Recarrega a base de conhecimento |
| `npm run seed:knowledge` | Mesmo que `atualizar-sulma` |

Documentação de contexto: `CONTEXT.md`. Deploy: `DEPLOY.md`.
