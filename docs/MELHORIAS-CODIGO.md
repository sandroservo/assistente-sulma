# Análise e melhorias do código – Assistente Sulma

Documento com sugestões de melhorias identificadas no projeto e o que já foi implementado.

---

## ✅ Já implementado nesta análise

### 1. **Segurança – API de configurações**
- **Problema:** `/api/settings` GET e POST não exigiam autenticação; qualquer um poderia ler ou alterar configurações (Evolution, OpenAI, system prompt).
- **Solução:** Exigir sessão e role `OWNER` ou `ADMIN` para GET e POST. Retorno 401/403 quando não autorizado.

### 2. **Multitenancy – Base de conhecimento**
- **Problema:** A página de conhecimento e a API GET listavam itens de **todas** as organizações; a API por ID permitia alterar/deletar conhecimento de outra org.
- **Solução:**
  - Página `/knowledge`: filtrar por `session.user.organizationId` e redirecionar para login se não houver sessão.
  - API GET `/api/knowledge`: exigir sessão e passar `organizationId` para `searchKnowledge`/`getAllKnowledge`.
  - API `/api/knowledge/[id]`: exigir sessão e verificar `knowledge.organizationId === session.user.organizationId` em GET, PUT e DELETE.
- **Interface:** `KnowledgeItem` em `src/lib/knowledge.ts` passou a incluir `organizationId` para tipagem correta.

---

## Sugestões de melhorias futuras

### Segurança

1. **Webhook Evolution – validação de origem**
   - Validar header ou body com o `webhookSecret` configurado (se a Evolution enviar) para evitar que terceiros disparem o webhook.
   - Ex.: checar header `x-webhook-signature` ou similar conforme documentação da Evolution.

2. **Rate limiting**
   - Aplicar rate limit em rotas sensíveis: login, webhook, APIs de mensagens e de IA, para reduzir abuso e custo de API.

3. **CORS e CSP**
   - Revisar headers de CORS e Content-Security-Policy em produção para restringir origens e scripts.

### Performance

4. **Cache de configurações**
   - `getSystemSettings()` é chamado em toda resposta da IA. Considerar cache em memória com TTL curto (ex.: 1–2 min) ou revalidação sob demanda ao salvar settings.

5. **Otimização de queries**
   - Em listagens (leads, conversas, knowledge), usar paginação consistente e índices no Prisma/DB onde fizer sentido (já há índices em `organizationId`, `category`, etc.).

### Código e manutenção

6. **Tratamento de erros**
   - Padronizar formato de erro das APIs (ex.: `{ ok: false, error: string, code?: string }`) e, em desenvolvimento, opcionalmente retornar `stack` ou mensagem técnica apenas quando seguro.

7. **Logging**
   - Trocar `console.log`/`console.error` por um logger (ex.: Pino) com níveis e, em produção, saída estruturada (JSON) para facilitar monitoramento.

8. **Testes**
   - Adicionar testes para: webhook Evolution (payloads válido/inválido), geração de resposta da IA (mock do OpenAI), e APIs de knowledge/settings (auth e org).

9. **Variáveis de ambiente**
   - Documentar no `.env.example` todas as variáveis usadas (NextAuth, DB, Evolution, OpenAI, etc.) e validar as obrigatórias na inicialização ou no primeiro uso.

### UX e produto

10. **Feedback de erros no dashboard**
    - Em falhas de API (settings, knowledge, mensagens), exibir toasts ou mensagens claras no front em vez de só no console.

11. **Nome do pacote**
    - Em `package.json` o nome já está como `sulma`.

12. **Middleware – rota /register**
    - A rota `/register` está como pública; confirmar se a aplicação expõe página de registro e, se não, remover da lista de rotas públicas ou redirecionar para login.

---

## Resumo

- **Crítico:** Proteção da API de settings e isolamento por organização na base de conhecimento (página + APIs) já foram aplicados.
- **Próximos passos sugeridos:** Validação do webhook, rate limiting, cache de settings, logging estruturado e testes automatizados.
