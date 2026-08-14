# Análise da pasta `fluxo` (n8n SDR) – uso no assistente Sulma

A pasta **fluxo** contém workflows **n8n** de um SDR (Sales Development Representative) que atendia WhatsApp. Abaixo está o que existe em cada arquivo e o que já aproveitamos ou podemos aproveitar na Sulma.

---

## Estrutura dos fluxos

| Arquivo | Função |
|--------|--------|
| **01-SDR.json** | Webhook principal: recebe mensagem → UserInfo → HiL (human in loop) → ParseMessage → MessageQueue → IA → Response |
| **02-SDR - UserInfo.json** | Busca/cria cliente no Supabase por WhatsApp |
| **03-SDR - HiL.json** | Human in loop: se mensagem for **fromMe** (enviada por nós), bloqueia o bot por 5 min (Redis) e desvia o fluxo |
| **04-SDR - ParseMessage.json** | Normaliza mensagem: texto → direto; áudio → transcrição; imagem → descrição (transforma tudo em `content`) |
| **05-SDR - MessageQueue.json** | Fila de mensagens |
| **06-SDR - IA.json** | Agente principal (SDR-Sulma) + tools: **Information** (base de dados Amo Vidas), **update** (atualiza lead no Supabase) |
| **07-SDR-Response.json** | Pega resposta da IA, divide por frases (pontuação), envia cada parte com delay (humanizado) |

---

## O que já temos na Sulma

- **Webhook Evolution** → recebe mensagem e chama nossa IA (equivalente ao 01 + parte do 07).
- **Base de conhecimento** (Tool Information) → equivalente à tool “Information” do n8n (planos, regras, check-ups, etc.).
- **Extração de nome/email** e atualização do lead → equivalente à tool “update” (em memória e no lead).
- **Resposta humanizada** (delay entre frases) → equivalente ao 07-SDR-Response (split + delay).
- **Detecção de “transferir para humano”** → similar ao HiL (quando o lead pede atendente, fazemos handoff).

---

## Melhorias extraídas do fluxo e aplicadas

### 1. **Fluxo de triagem (perguntas em ordem lógica)**

No n8n, a Sulma segue uma ordem de perguntas para qualificar:

1. “O foco é cuidado de rotina ou exames mais específicos?”
2. “É para você ou vai incluir dependentes?”
3. “Tem alguém com mais de 60 anos?”
4. “Você quer mais economia mensal ou mais cobertura de exames/benefícios?”

**Uso na Sulma:** incorporamos essa ordem como **sugestão** no prompt padrão, sem forçar script: a Sulma pode usar essas perguntas na hora de direcionar o plano, mantendo conversa natural.

### 2. **Validador antes de dar preço/link**

No n8n:

- Só dizer preço se estiver na Tool Information.
- Só enviar links que existam na Tool Information.
- Se faltar dado: “Não tenho essa informação no momento” + pergunta de continuidade ou oferta de link.

**Uso na Sulma:** regras equivalentes já estavam no nosso prompt (usar só Tool Information, não inventar). Reforçamos a parte de **não inventar preços/links** e de oferecer atendente ou link quando não tiver o dado.

### 3. **Critério de qualificação**

No n8n, o lead é qualificado quando pergunta sobre: planos, valores, check-ups, exames, consultas, especialidades, dependentes, regras, carência, como assinar, links, locais.

**Uso na Sulma:** nosso `detectLeadStatus` já usa palavras-chave parecidas; o fluxo n8n serviu de referência para alinhar o conceito de “qualificado”.

### 4. **Respostas curtas de referência**

No n8n há blocos prontos, por exemplo:

- “O que é Amo Vidas?” → resposta curta + pergunta (rotina ou exames mais específicos).
- “Qual plano é melhor?” → depende do objetivo, rotina/especializado/cobertura, dependentes.
- “Me manda o link” → benefícios ou link para assinar?

**Uso na Sulma:** usamos como **exemplos de tom e estrutura** no prompt (resposta curta + uma pergunta), sem copiar texto fixo.

---

## O que podemos implementar no futuro

### 1. **Áudio e imagem (ParseMessage)**

No n8n: áudio é transcrito e imagem é descrita; ambos viram `content` para a IA.

**Na Sulma:** hoje só tratamos texto. Podemos:

- No webhook Evolution, detectar `audioMessage` / `imageMessage`.
- Áudio: enviar para API de transcrição (ex.: Whisper) e usar o texto na Sulma.
- Imagem: enviar para visão (ex.: GPT-4 Vision) e usar a descrição como contexto da mensagem.

### 2. **Human in the loop (HiL)**

No n8n: quando a mensagem é **fromMe**, o bot é “desligado” por 5 minutos (Redis) para um humano atender.

**Na Sulma:** já temos handoff (transferir para humano). Podemos evoluir para:

- Ao transferir, marcar conversa como “humano atendendo” e não responder com a Sulma até o atendente “devolver” a conversa ao bot.
- Opcional: tempo de “resfriamento” (ex.: 5 min) após uma mensagem enviada por humano antes da Sulma voltar a responder.

### 3. **Resumo da conversa (tool update)**

No n8n, o agente “update” gera um resumo (necessidades, objeções, interesse, plano sugerido, próximos passos) e grava no lead.

**Na Sulma:** já temos memórias do lead (preferências, objeções, etc.). Podemos:

- Gerar um **resumo da conversa** (últimas N mensagens) periodicamente ou ao qualificar/fechar e salvar em LeadMemory ou em um campo do Lead (ex.: `conversationSummary`).

### 4. **Tabela de dependentes e exemplos de valor**

No n8n, a tool “Information” tem:

- Tabela de preços por plano (titular + dep1, dep2, dep3 e total).
- Exemplos de valor (ex.: consulta ortopédica de R$ 600 → R$ 99).

**Na Sulma:** isso pode virar itens na **base de conhecimento** (categoria planos/pagamento), para a Sulma citar valores e dependentes sem inventar.

---

## Resumo

- A pasta **fluxo** é a versão n8n do mesmo objetivo da Sulma: qualificar leads no WhatsApp com base em planos e regras do Amo Vidas.
- **Já aproveitamos:** ideia de triagem em ordem, validação antes de preço/link, critério de qualificação e estilo de resposta curta com uma pergunta.
- **Próximos passos sugeridos:** suporte a áudio (transcrição) e imagem (visão), Human in the loop fino (bot pausado enquanto humano atende), resumo de conversa no lead e enriquecer a base de conhecimento com tabela de dependentes e exemplos de valor.
