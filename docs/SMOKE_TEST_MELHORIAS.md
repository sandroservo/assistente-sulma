# Smoke test — melhorias (campanhas · SLA · RAG · fluxos)

Rodar **local** antes de levar pra produção. Ordem importa.

Legenda: 🖥️ = terminal · 🌐 = navegador (logado) · 🗄️ = psql

---

## 0. Setup

🖥️
```bash
# 1. Aplicar as 3 migrations no banco LOCAL (confirme que DATABASE_URL do .env é local, não prod!)
npx prisma migrate deploy

# 2. pgvector precisa da extensão (superuser). Se o migrate deploy falhar no CREATE EXTENSION:
#    conecte como superuser e rode manualmente, depois repita o migrate deploy:
#    psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;'

npx prisma generate
npm run dev   # sobe em http://localhost:3000
```

Confirmar tabelas criadas — 🗄️
```bash
psql "$DATABASE_URL" -c '\dt "Campaign" "CampaignRun" "CampaignContact" "Flow"'
psql "$DATABASE_URL" -c '\d "Knowledge"' | grep embedding   # deve mostrar "vector(1536)"
```

---

## 1. Motor de fluxos (não precisa de banco — puro)

🖥️
```bash
npx tsx scripts/flow-engine-check.ts
# Esperado: "OK — flow-engine self-check passou"
```

---

## 2. Campanhas 🌐 http://localhost:3000/campaigns

1. Criar campanha: nome, mensagem, público = "Todos os leads", recorrência = **Única**, sem agendar.
2. Clicar **Disparar**.
   - ⚠️ precisa de ao menos 1 **instância CONNECTED** e leads na org. Sem instância → cada contato vira erro "Sem instância disponível" (esperado — valida o drill-down).
3. Aguardar ~alguns seg, recarregar. Conferir funil: Total / Enviados / Erros.
4. Se houver erros, clicar **Ver erros** → aparece telefone + motivo (`errorKind: errorMsg`).

Recorrência + cron — 🖥️ (endpoint aceita `key=manual`)
```bash
# Crie uma campanha com recorrência Semanal e "Agendar para" uma data JÁ passada, então:
curl "http://localhost:3000/api/cron/campaigns?key=manual"
# Esperado: {"ok":true,"processed":N,...}. Depois a campanha deve reagendar scheduledAt +7 dias.
```
🗄️ conferir persistência:
```bash
psql "$DATABASE_URL" -c 'SELECT status,total,sent,failed FROM "CampaignRun" ORDER BY "startedAt" DESC LIMIT 3;'
```

---

## 3. Auto-close por inatividade

🗄️ ligar pra sua org (pega o id em Organization):
```bash
psql "$DATABASE_URL" -c "INSERT INTO \"OrgSettings\"(id,\"organizationId\",key,value,\"updatedAt\") \
  VALUES ('acd_'||substr(md5(random()::text),1,8),(SELECT id FROM \"Organization\" LIMIT 1),'auto_close_days','3',now()) \
  ON CONFLICT(\"organizationId\",key) DO UPDATE SET value='3';"
```
🖥️
```bash
curl "http://localhost:3000/api/cron/maintenance?key=manual"
# Esperado: {"ok":true,"closed":N,"perOrg":[...]}  (fecha conversas open com lastMessageAt > 3 dias)
```

---

## 4. SLA visual

- 🌐 http://localhost:3000/reports → 3 cards **TME / TMA / TMR** aparecem (mostram "—" se não houver histórico de handoff).
- 🌐 http://localhost:3000/chats → na lista, conversa **não lida + aberta** com última msg antiga mostra bolinha colorida (amarelo ≥10min, laranja ≥1h, vermelho ≥1 dia). Tooltip "Esperando resposta — Há Xh".
  - Pra forçar: 🗄️ `UPDATE "Conversation" SET "lastMessageAt"=now()-interval '2 hours', "unreadCount"=1, status='open' WHERE id=(SELECT id FROM "Conversation" LIMIT 1);` → recarregar /chats (deve ficar laranja).

---

## 5. RAG (pgvector)

1. Reindexar base existente — 🌐 logado, console do navegador (F12):
   ```js
   fetch('/api/knowledge/reindex',{method:'POST'}).then(r=>r.json()).then(console.log)
   // Esperado: {ok:true, total:N, indexed:N}  (precisa OPENAI_API_KEY válida)
   ```
2. 🗄️ conferir embeddings preenchidos:
   ```bash
   psql "$DATABASE_URL" -c 'SELECT count(*) FILTER (WHERE embedding IS NOT NULL) AS com_emb, count(*) AS total FROM "Knowledge";'
   ```
3. Teste semântico: mande o bot (ou chame o fluxo de IA) uma pergunta que **não** contém as keywords cadastradas mas é sinônimo. Deve trazer o conhecimento certo. Se `OPENAI_API_KEY` faltar/erro → cai no keyword (comportamento antigo), sem quebrar.

---

## 6. Editor de fluxos 🌐 http://localhost:3000/flows

1. **Novo fluxo** → abre editor.
2. Adicionar **Texto** (mensagem "Olá"), **Captura** (pergunta "Seu nome?", variável `nome`), **Texto** ("Oi {{nome}}"), **Condição**, **Transferir**.
3. Ligar os nós arrastando das bolinhas (start → texto → captura → texto → condição → ...).
4. Clicar numa seta que sai da Condição → definir **palavra-chave** (ex: `financeiro`). Deixar uma seta sem keyword = padrão.
5. **Salvar**. Recarregar a página → grafo persiste.
6. Painel direito (clicar no vazio do canvas) → **Simulador** → Iniciar, responder. Conferir interpolação `{{nome}}` e o branch da condição.

> Lembrar: fluxos ainda **não** rodam no bot ao vivo — só editor + simulador.

---

## Rollback local (se precisar)
```bash
psql "$DATABASE_URL" -c 'DROP TABLE IF EXISTS "CampaignContact","CampaignRun","Campaign","Flow" CASCADE;'
psql "$DATABASE_URL" -c 'ALTER TABLE "Knowledge" DROP COLUMN IF EXISTS embedding;'
# e remover as pastas em prisma/migrations correspondentes antes de novo migrate
```

**Passou tudo?** → deploy pra produção (mesmos passos do 0, DATABASE_URL de prod, confirmar superuser pro CREATE EXTENSION).
