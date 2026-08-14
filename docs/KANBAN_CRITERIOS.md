# Critérios de Movimentação do Kanban - Assistente Sulma

> **Autor:** Sandro Servo  
> **Site:** https://cloudservo.com.br  
> **Última atualização:** 07/02/2026

---

## Visão Geral

O Kanban do Assistente Sulma organiza os leads em colunas por status. A movimentação acontece de **duas formas**:

1. **Automática** — A Sulma (IA) ou o sistema detecta sinais na conversa e move o lead.
2. **Manual** — O atendente arrasta o card no Kanban ou clica em botões de ação.

---

## Status Disponíveis

| Status | Descrição |
|---|---|
| `NOVO` | Lead acabou de entrar (primeira mensagem recebida) |
| `EM_ATENDIMENTO` | Lead está conversando com a Sulma (bot) |
| `QUALIFICADO` | Lead demonstrou interesse real nos planos |
| `LEAD_FRIO` | Lead demonstrou hesitação ou pediu para pensar |
| `PROPOSTA_ENVIADA` | Proposta/link de plano enviado ao lead |
| `EM_NEGOCIACAO` | Lead em negociação ativa |
| `AGUARDANDO_RESPOSTA` | Lead parou de responder (follow-ups agendados) |
| `HUMANO_SOLICITADO` | Lead pediu para falar com atendente humano |
| `HUMANO_EM_ATENDIMENTO` | Atendente humano assumiu a conversa |
| `FECHADO` | Lead convertido (pagamento confirmado ou intenção de compra) |
| `PERDIDO` | Lead desistiu ou demonstrou desinteresse |

---

## Transições Automáticas (pela Sulma / Sistema)

### 1. NOVO → EM_ATENDIMENTO

- **Quando:** O lead troca **2 ou mais mensagens** com a Sulma, sem demonstrar interesse qualificado.
- **Lógica:** Se o lead está como `NOVO` e já tem 2+ mensagens no histórico, é movido para `EM_ATENDIMENTO`.
- **Objetivo:** Diferenciar leads que apenas mandaram a primeira mensagem dos que já estão interagindo.

### 2. NOVO / EM_ATENDIMENTO → QUALIFICADO

- **Quando:** O lead demonstra **interesse real** nos planos ou serviços.
- **Palavras-chave detectadas:**
  - "quanto custa", "qual o valor", "qual o preço"
  - "como funciona", "me explica", "pode me explicar"
  - "tenho interesse", "quero saber mais", "me conta mais"
  - "gostei", "interessante", "parece bom"
  - "quais são os planos", "me fala dos planos"
  - "tem desconto", "formas de pagamento", "como pago"
  - "quero assinar", "quero contratar"
- **Condição:** O lead precisa ter pelo menos 1 mensagem no histórico (se estiver como `NOVO`).
- **Pode ser acionado a partir de:** `NOVO`, `EM_ATENDIMENTO`, `PROPOSTA_ENVIADA`, `EM_NEGOCIACAO`, `AGUARDANDO_RESPOSTA`.

### 3. Qualquer → LEAD_FRIO

- **Quando:** O lead demonstra **hesitação ou esfriamento**.
- **Palavras-chave detectadas:**
  - "vou pensar", "preciso pensar"
  - "depois eu vejo", "talvez"
  - "não agora", "mais tarde", "outro dia"
  - "semana que vem", "mês que vem"
  - "não é o momento", "vou analisar", "deixa eu ver"
- **Objetivo:** Identificar leads que estão esfriando para priorizar ações de reengajamento.

### 4. Qualquer → FECHADO

- **Quando:** O lead demonstra **intenção clara de compra**.
- **Palavras-chave detectadas:**
  - "vou comprar", "quero comprar"
  - "fechar negócio", "vou fechar", "vamos fechar"
  - "pode mandar o pix", "manda o pix"
  - "vou pagar", "quero pagar"
  - "aceito", "combinado"
  - "pode enviar", "manda o contrato"
  - "vou assinar", "contrato assinado"
  - "pagamento feito", "já paguei", "paguei agora"

### 5. Qualquer → PERDIDO

- **Quando:** O lead demonstra **desistência ou desinteresse**.
- **Palavras-chave detectadas:**
  - "não tenho interesse", "não quero", "não preciso"
  - "desisto", "deixa pra lá", "esquece"
  - "não é pra mim", "muito caro", "sem condições"
  - "não posso pagar"
  - "já comprei em outro lugar", "já tenho"
  - "não me interessa"

### 6. Qualquer → HUMANO_SOLICITADO

- **Quando:** O lead pede para **falar com um atendente humano**.
- **Palavras-chave detectadas:**
  - "atendente", "humano", "pessoa real"
  - "falar com alguém", "quero falar", "preciso falar"
  - "gerente", "reclamação", "cancelar"
- **Ação automática:** A Sulma avisa o lead que será transferido e muda o `ownerType` para `human` (o bot para de responder).

---

## Transições por Ação do Atendente

### 7. Qualquer → HUMANO_EM_ATENDIMENTO

- **Gatilho:** O atendente clica em **"Iniciar atendimento"** no painel, ou envia mensagem diretamente pelo WhatsApp.
- **Efeito:** O bot para de responder. O lead recebe uma mensagem informando o nome do atendente que vai atendê-lo.

### 8. HUMANO_EM_ATENDIMENTO → EM_ATENDIMENTO

- **Gatilho:** O atendente clica em **"Devolver para Sulma (Bot)"**.
- **Efeito:** A Sulma volta a responder automaticamente as mensagens do lead.

### 9. Qualquer → AGUARDANDO_RESPOSTA

- **Gatilho:** O atendente clica em **"Cliente parou de responder"**.
- **Efeito:** Agenda **4 follow-ups automáticos** que a Sulma envia:
  - **24h:** "Oi! Só passando pra ver se você conseguiu pensar sobre os planos do Amo Vidas 🙂"
  - **48h:** "Oi! Ainda faz sentido conversarmos sobre o clube de benefícios? Estou aqui pra te ajudar!"
  - **72h:** "Se precisar de ajuda pra escolher o melhor plano, é só me chamar! 😊"
  - **120h:** "Última mensagem por aqui! Se quiser retomar depois, é só me chamar. Cuide-se! 🌟"

### 10. Drag & Drop no Kanban

- **Gatilho:** O atendente **arrasta o card** de uma coluna para outra no Kanban.
- **Efeito:** Atualiza o status do lead para o da coluna de destino. Aceita todos os status válidos.

---

## Transições por Integração (Asaas - Pagamentos)

### 11. Qualquer → FECHADO (Pagamento Confirmado)

- **Gatilho:** Webhook do Asaas recebe evento `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED`.
- **Efeito:** Lead é marcado como `FECHADO` e recebe mensagem de confirmação no WhatsApp.

### 12. FECHADO → QUALIFICADO (Pagamento Vencido)

- **Gatilho:** Webhook do Asaas recebe evento `PAYMENT_OVERDUE`.
- **Efeito:** Lead volta para `QUALIFICADO` (pode precisar de reengajamento) e recebe lembrete de pagamento.

---

## Fluxo Visual do Funil

```
                    ┌─────────────────────────────────────┐
                    │              NOVO                    │
                    │  (Lead mandou primeira mensagem)     │
                    └──────────────┬──────────────────────┘
                                   │
                          2+ mensagens
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         EM_ATENDIMENTO               │
                    │  (Conversando com a Sulma)              │
                    └──┬───────┬───────┬──────┬───────┬───┘
                       │       │       │      │       │
                  interesse  hesitou  pediu  desistiu  parou
                       │       │     humano    │    responder
                       ▼       ▼       ▼       ▼       ▼
                 QUALIFICADO  LEAD   HUMANO  PERDIDO  AGUARDANDO
                       │      FRIO  SOLICITADO         RESPOSTA
                       │               │
                  comprou/pagou    atendente
                       │           assumiu
                       ▼               ▼
                    FECHADO    HUMANO_EM_ATENDIMENTO
```

---

## Observações Importantes

1. **Prioridade de detecção:** PERDIDO > FECHADO > QUALIFICADO > EM_ATENDIMENTO > LEAD_FRIO. Ou seja, se o lead diz "não quero" e "quanto custa" na mesma mensagem, prevalece `PERDIDO`.

2. **Status protegido:** O lead **não regride** de `FECHADO` automaticamente (exceto por `PAYMENT_OVERDUE` do Asaas). A detecção automática só move para `QUALIFICADO` se o status atual **não for** `FECHADO`.

3. **Detecção por mensagem atual:** As keywords de `PERDIDO`, `FECHADO` e `LEAD_FRIO` são verificadas **apenas na mensagem atual** do lead. Já `QUALIFICADO` verifica no **histórico completo** da conversa.

4. **Follow-ups:** Os follow-ups são executados por um **cron job a cada 15 minutos** que verifica follow-ups pendentes com data vencida.

5. **Handoff (transferência):** Quando um atendente envia mensagem diretamente pelo WhatsApp (sem usar o painel), o sistema automaticamente assume que o humano tomou o controle e move o lead para `HUMANO_EM_ATENDIMENTO`.
