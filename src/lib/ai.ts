/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Serviço de IA da Sulma
 */

import OpenAI from "openai";
import { prisma } from "./prisma";
import { getSystemSettings } from "./settings";
import { getAllKnowledge, searchKnowledge, formatKnowledgeForAI } from "./knowledge";
import { getAllMemories, formatMemoriesForAI, extractAndSaveMemories } from "./memory";
import { listarClientesVencidos, hasCobrancaToken, buscarDevedorPorTelefone, hasCampanhaToken, buscarLeadCampanhaPorTelefone } from "./amovidas-api";

async function getOpenAIClient() {
  const settings = await getSystemSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return null;
  }
  
  return new OpenAI({ apiKey });
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ConversationContext {
  leadId: string;
  organizationId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
  leadCity?: string | null;
  leadPhone?: string;
  leadStatus?: string;
  messageHistory: { direction: "in" | "out"; body: string | null }[];
}

/**
 * Retorna o período do dia no fuso do Brasil (America/Sao_Paulo) para a Sulma usar saudação adequada
 */
function getPeriodoDoDia(): { periodo: string; saudacao: string; horaFormatada: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const horaFormatada = formatter.format(now);
  const hour = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();

  if (hour >= 0 && hour < 6) {
    return { periodo: "madrugada", saudacao: "Boa madrugada", horaFormatada };
  }
  if (hour >= 6 && hour < 12) {
    return { periodo: "manhã", saudacao: "Bom dia", horaFormatada };
  }
  if (hour >= 12 && hour < 18) {
    return { periodo: "tarde", saudacao: "Boa tarde", horaFormatada };
  }
  return { periodo: "noite", saudacao: "Boa noite", horaFormatada };
}

const DEFAULT_SYSTEM_PROMPT = `Você é a Sulma, consultora de saúde do Clube Amo Vidas. Você fala por WhatsApp com leads que podem virar clientes.

CONVERSA NATURAL (PRIORIDADE MÁXIMA):
- Reaja ao que a pessoa disse antes de fazer a próxima pergunta. Nunca ignore a mensagem dela e pule direto para uma pergunta de script.
- Exemplo: se ela disser "é pra mim e pro meu filho", não responda só "Tem alguém com mais de 60 anos?". Reaja antes: "Que legal, então são vocês dois! E no caso de vocês, tem alguém com mais de 60 anos?"
- Se ela contar algo (ex.: "tô precisando fazer uns exames"), reconheça com uma frase curta antes de responder: "Entendi, então você tá buscando cuidar disso...", e aí traga a informação ou a próxima pergunta.
- Deixe a conversa fluir: às vezes a pessoa responde algo que já responde a outra pergunta; use isso e não repita perguntas. Às vezes ela pergunta algo no meio; responda com naturalidade e depois retome se precisar.
- Sua mensagem deve parecer uma resposta à mensagem dela, não um bloco genérico + pergunta. Evite começar direto com uma pergunta sem nenhum "gancho" no que ela falou.
- Se ela fizer uma pergunta, responda primeiro (com base na Tool Information) e, se fizer sentido, acrescente uma pergunta ou convite natural no final — não o contrário (pergunta primeiro, resposta depois).

TOM E ESTILO:
- Escreva como no WhatsApp para um conhecido: calorosa, direta. Use "Olha...", "Então...", "Ah, ótimo!", coloquial ("né", "tá", "pra") quando cair bem.
- Frases corridas, não listas. Emoji de vez em quando. NUNCA soe como FAQ ou script.

REGRAS DE CONTEÚDO:
- Use EXCLUSIVAMENTE o que está em <Tool Information>. NUNCA invente dados (valores, regras, prazos).
- Se houver bloco "Cobranças vencidas" na Tool Information, use para responder perguntas sobre clientes em atraso, inadimplentes ou faturas vencidas. Resuma de forma objetiva (ex.: "Temos X clientes com cobrança em atraso").
- Você SEMPRE recebe a base de conhecimento; use o que for mais próximo da dúvida (planos, valores, benefícios). Se a informação exata não estiver lá, resuma o que tiver de relevante e ofereça transferir para um atendente para detalhes: "Quer que eu te passe para alguém da equipe te dar essa informação direitinho?"
- NUNCA diga "Não tenho essa informação no momento" nem que não tem a informação. Prefira usar algo da base + oferecer atendente humano.
- Antes de citar preço ou enviar link: confira se está na Tool Information. Só envie links que existam nela. Se houver mais de um valor (ex.: 37,00 e 37,90), use o principal e pode oferecer o link oficial para confirmar.
- Respostas curtas (3–4 frases). Uma pergunta por vez quando for perguntar.
- Se pedir atendente humano, confirme que vai transferir. Se não souber o nome, pergunte de forma natural.
- O Amo Vidas NÃO é plano de saúde, NÃO é convênio. É um CLUBE DE BENEFÍCIOS em saúde por assinatura.
- NUNCA prometa cura, cobertura total irrestrita, ou chame de plano de saúde.
- A assinatura NUNCA é o produto principal. O produto é o CUIDADO (check-up, consulta, exame). A assinatura é só o meio mais econômico.

QUIZ CONVERSACIONAL (fluxo natural, NÃO como script rígido):
Após se apresentar e saber o nome, conduza o quiz de forma natural para qualificar o lead:
1. MOMENTO DE SAÚDE — "Hoje, qual dessas situações mais parece com você? Faz tempo que não faz exames, quer prevenir, sentindo algo, ou só se informando?"
2. ROTINA DE EXAMES — "Quando foi a última vez que fez um check-up ou exames de rotina?"
3. TIPO DE CUIDADO — "Pensando no cuidado com saúde, o que seria mais importante: check-up completo, consultas quando precisar, exames específicos, ou tudo aos poucos?"
4. FAMÍLIA — "Esse cuidado seria só pra você ou pra mais alguém da família?"
5. EMAIL E CIDADE — Em algum momento natural da conversa (depois de saber o nome, antes do resumo), peça email e cidade de forma leve. Pode ser junto ou separado: "Me passa seu email e de qual cidade você é? Assim consigo te enviar as informações certinhas 📩" ou "Qual seu email?" e depois "E você é de onde?". Se já tiver o email, NÃO peça novamente. Se já tiver a cidade, NÃO peça novamente.
6. PAGAMENTO — "Você prefere pagar tudo quando precisa ou organizar por mês?"
7. RESUMO PERSONALIZADO — Faça um resumo do que entendeu: "Pelo que me contou, o ideal pra você é..." (momento CHAVE — gerar "ela me entendeu")
8. ENTRADA DA ASSINATURA — Só DEPOIS do resumo: "Quem faz check-up e consultas com frequência costuma economizar bastante usando a assinatura, em vez de pagar tudo avulso."
9. DECISÃO SUAVE — "Quer que eu te mostre o formato mais vantajoso no seu caso?"

IMPORTANTE: O quiz é um GUIA, não um script. Se o lead já respondeu algo, não repita. Se ele pergunta algo, responda e retome depois. Pule perguntas quando a pessoa já deu a informação.

REGRA DE OURO:
- Entendimento do produto vale mais que renda
- Pergunta boa vale mais que resposta rápida
- A pessoa se diagnostica sozinha — não empurre nada
- O plano aparece como solução lógica, não como venda

HANDOFF — Transfira para humano quando:
- Lead pede valores exatos por procedimento
- Lead demonstra intenção clara de contratar ("quero assinar", "pode mandar o link")
- Pergunta vira comparação direta com plano de saúde
- Frase de transição: "Posso te explicar melhor ou, se preferir, te coloco agora com um atendente humano pra tirar todas as dúvidas finais 🙂"`;

export { DEFAULT_SYSTEM_PROMPT };

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext
): Promise<{ response: string; extractedData?: { name?: string; email?: string } }> {
  try {
    const settings = await getSystemSettings();
    const openai = await getOpenAIClient();
    
    if (!openai) {
      console.warn("OpenAI API Key não configurada, usando resposta padrão");
      return { response: generateFallbackResponse(userMessage, context.leadName) };
    }

    // Usa prompt do banco (/settings) ou o padrão
    const systemPrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Base de conhecimento única (single-tenant): busca toda a base, sem filtro de organização.
    const isFirstMessage = context.messageHistory.length === 0;

    let knowledge: Awaited<ReturnType<typeof getAllKnowledge>>;
    if (isFirstMessage) {
      knowledge = await getAllKnowledge(undefined, 100, undefined);
    } else {
      const [searchResults, baseKnowledge] = await Promise.all([
        searchKnowledge(userMessage, undefined, 25, undefined),
        getAllKnowledge(undefined, 60, undefined),
      ]);
      const byId = new Map(searchResults.map((k) => [k.id, k]));
      baseKnowledge.forEach((k) => byId.set(k.id, k));
      knowledge = Array.from(byId.values());
    }
    let toolInformation = formatKnowledgeForAI(knowledge);

    // Se a mensagem menciona cobrança/vencidos e temos token, busca dados em tempo real do Amo Vidas
    const cobrancaKeywords = [
      "vencidos", "em atraso", "cobrança", "cobrancas", "inadimplentes",
      "quem deve", "clientes vencidos", "faturas vencidas", "pagamentos atrasados",
      "lista de vencidos", "quantos vencidos",
    ];
    const msgLower = userMessage.toLowerCase();
    const isCobrancaQuery = cobrancaKeywords.some((k) => msgLower.includes(k));
    if (isCobrancaQuery && hasCobrancaToken()) {
      const cobrancaData = await listarClientesVencidos();
      if (cobrancaData.ok && cobrancaData.clients && cobrancaData.clients.length >= 0) {
        const cobrancaBlock = [
          "<Tool Information>",
          "## Cobranças vencidas (dados em tempo real do sistema Amo Vidas)",
          `Total de clientes com cobrança em atraso: ${cobrancaData.total ?? cobrancaData.clients.length}`,
          "",
          cobrancaData.clients.length > 0
            ? cobrancaData.clients
                .slice(0, 20)
                .map(
                  (c) =>
                    `- ${c.customerName}: R$ ${c.value.toFixed(2)}, ${c.daysOverdue} dias em atraso (vencimento: ${c.dueDate})`
                )
                .join("\n")
            : "Nenhum cliente com cobrança vencida no momento.",
          "</Tool Information>",
        ].join("\n");
        toolInformation = toolInformation
          ? `${toolInformation}\n\n${cobrancaBlock}`
          : cobrancaBlock;
      }
    }

    // Modo Hermes (cobrança): se quem fala é cliente devedor, a Sulma vira o agente
    // de cobrança humano — lembra da dívida, avisa bloqueio/perda de benefícios,
    // oferece o link, e transfere p/ humano em negociação/parcelamento.
    if (hasCobrancaToken() && context.leadPhone) {
      const dev = await buscarDevedorPorTelefone(context.leadPhone);
      if (dev.found && (dev.debtTotal ?? 0) > 0) {
        const valor = `R$ ${(dev.debtTotal ?? 0).toFixed(2).replace(".", ",")}`;
        const hermesBlock = [
          "<Tool Information>",
          "## MODO COBRANÇA (este contato é um CLIENTE com dívida em aberto — você continua sendo a Sulma)",
          `Nome: ${dev.name} · Plano: ${dev.planTitle || "AMO VIDAS"}`,
          `Dívida total em aberto: ${valor} (${dev.chargesCount ?? 1} parcela(s), ${dev.daysOverdue ?? 0} dias, situação: ${dev.situation})`,
          dev.lastPaymentLink ? `Link de pagamento já gerado (com tudo somado): ${dev.lastPaymentLink}` : "Ainda não há link gerado — ofereça gerar e, se ele aceitar, avise que já envia.",
          "",
          "COMO AGIR (como a Sulma, humana e respeitosa):",
          "- Reconheça a pessoa pelo nome e trate com empatia; nada de robótico.",
          "- Se ela perguntar valor/2ª via/PIX/vencimento, responda com os dados acima e ofereça o link.",
          `- Se a situação for 'bloqueado' ou 'inadimplente', avise com franqueza que o acesso pode ser/está suspenso e que ela perde os benefícios (telemedicina, descontos, rede credenciada), inclusive para dependentes.`,
          "- Se ela quiser PARCELAR, NEGOCIAR, reclamar, contestar a dívida ou disser que não deve: NÃO negocie sozinho — diga que vai chamar um atendente e encerre pedindo um instante (isso dispara transferência para humano).",
          "- Nunca invente valores/prazos além dos acima. Não prometa desconto.",
          "</Tool Information>",
        ].join("\n");
        toolInformation = toolInformation ? `${toolInformation}\n\n${hermesBlock}` : hermesBlock;
      }
    }

    // Modo Campanha: se quem fala é um lead de campanha promocional (indicador que
    // ganhou exames a resgatar, ou indicado que concorre ao sorteio), a Sulma acompanha
    // no contexto da campanha — continua sendo a Sulma.
    if (hasCampanhaToken() && context.leadPhone) {
      const camp = await buscarLeadCampanhaPorTelefone(context.leadPhone);
      if (camp.found) {
        const linhas = camp.role === "indicador"
          ? [
              `Este contato é um INDICADOR da campanha "${camp.campanha}".`,
              `Nome: ${camp.indicadorName}. Exames grátis conquistados por indicações: ${camp.examesGanhos ?? 0}.`,
              `Sorteio: ${camp.sorteioInfo}. Prêmio: ${camp.premioInfo}.`,
              "",
              "COMO AGIR (como a Sulma, calorosa e humana):",
              "- Parabenize pela participação e confirme quantos exames grátis já garantiu.",
              "- Se pedir para RESGATAR o exame, oriente: um atendente vai confirmar os dados e agendar; peça um instante (isso transfere para humano).",
              "- Incentive a indicar mais pais/amigos para ganhar mais exames (respeitando o limite da campanha).",
              "- Tire dúvidas sobre a campanha, sorteio e prêmio com os dados acima. Não invente datas/valores.",
            ]
          : [
              `Este contato é um INDICADO na campanha "${camp.campanha}", indicado por ${camp.indicadorName}.`,
              `Sorteio: ${camp.sorteioInfo}. Prêmio: ${camp.premioInfo}.`,
              "",
              "COMO AGIR (como a Sulma, calorosa e humana):",
              `- Dê as boas-vindas: ${camp.indicadorName} o(a) indicou e agora ele(a) está concorrendo ao sorteio.`,
              "- Explique o prêmio e a data do sorteio com os dados acima.",
              "- Se demonstrar interesse nos planos/benefícios do Amo Vidas, apresente e ofereça ajuda para assinar.",
              "- Não invente datas/valores além dos acima.",
            ];
        const campanhaBlock = [
          "<Tool Information>",
          `## MODO CAMPANHA (${camp.campanha}) — este contato é um lead da campanha; você continua sendo a Sulma`,
          ...linhas,
          "- Se for reclamação, negociação ou pedido fora do escopo: chame um atendente humano (peça um instante).",
          "</Tool Information>",
        ].join("\n");
        toolInformation = toolInformation ? `${toolInformation}\n\n${campanhaBlock}` : campanhaBlock;
      }
    }

    // Busca memórias do lead
    const leadMemories = await getAllMemories(context.leadId);
    const memoryContext = formatMemoriesForAI(leadMemories);

    // Verifica se a última mensagem do bot perguntou o nome
    const lastBotMessage = context.messageHistory
      .filter(m => m.direction === "out" && m.body)
      .pop()?.body?.toLowerCase() || "";
    const botAskedName = lastBotMessage.includes("chamar") || 
                         lastBotMessage.includes("nome") ||
                         lastBotMessage.includes("quem fala");

    // Extrai e salva memórias da mensagem atual
    const { extractedName } = await extractAndSaveMemories(
      context.leadId, 
      userMessage, 
      true,
      botAskedName
    );
    
    // Só atualiza o nome do lead se ele ainda não tiver nome (não sobrescreve durante a conversa)
    if (extractedName && !context.leadName?.trim()) {
      await prisma.lead.update({
        where: { id: context.leadId },
        data: { name: extractedName },
      });
      context.leadName = extractedName;
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
    ];

    // Adiciona Tool Information (base de conhecimento) — a Sulma DEVE consultar para planos, parceiros, preços, etc.
    if (toolInformation) {
      messages.push({
        role: "system",
        content: `${toolInformation}\n\nIMPORTANTE: Use o bloco <Tool Information> acima para responder perguntas sobre planos, preços, parceiros do Clube de Desconto, benefícios, links e regras. Consulte sempre essa base antes de responder.`,
      });
    }

    // Adiciona memórias do lead
    if (memoryContext) {
      messages.push({
        role: "system",
        content: memoryContext,
      });
    }

    // Contexto de horário (Brasil): Sulma sabe se é dia, tarde, noite ou madrugada
    const { periodo, saudacao, horaFormatada } = getPeriodoDoDia();
    messages.push({
      role: "system",
      content: `Agora são ${horaFormatada} (horário de Brasília). Período: ${periodo}. Use a saudação adequada quando for começar ou cumprimentar: ${saudacao}. Seja natural com o horário (ex.: de madrugada pode ser mais breve; de manhã/tarde/noite use o cumprimento correto).`,
    });

    // Adiciona contexto do lead (usa isFirstMessage já definida acima)
    if (isFirstMessage) {
      messages.push({
        role: "system",
        content: `Esta é a PRIMEIRA mensagem do cliente. Apresente-se de forma breve e calorosa (ex.: "${saudacao}! Sou a Sulma, consultora do Amo Vidas 💜") e pergunte o nome de forma natural, como uma pessoa real no WhatsApp. Não use texto de script.`,
      });
    } else if (context.leadName) {
      messages.push({
        role: "system",
        content: `O nome do cliente é: ${context.leadName}`,
      });
    } else {
      const msgCount = context.messageHistory.filter(m => m.direction === "in").length;
      if (msgCount >= 2) {
        messages.push({
          role: "system",
          content: `ATENÇÃO: Você AINDA NÃO SABE o nome do cliente (já são ${msgCount + 1} mensagens dele). PRIORIDADE MÁXIMA: pergunte o nome AGORA de forma direta e calorosa. Ex: "Antes de continuar, como posso te chamar? 😊" — NÃO prossiga com o quiz sem saber o nome.`,
        });
      } else {
        messages.push({
          role: "system",
          content: `Você ainda não sabe o nome do cliente. Pergunte o nome dele de forma natural e calorosa. Ex: "Como posso te chamar?"`,
        });
      }
    }

    // Contexto de email e cidade: Sulma sabe o que já tem e o que falta pedir
    const missingData: string[] = [];
    const collectedData: string[] = [];

    if (context.leadEmail) {
      collectedData.push(`Email: ${context.leadEmail}`);
    } else {
      missingData.push("email");
    }

    if (context.leadCity) {
      collectedData.push(`Cidade: ${context.leadCity}`);
    } else {
      missingData.push("cidade");
    }

    if (collectedData.length > 0) {
      messages.push({
        role: "system",
        content: `Dados já coletados do cliente: ${collectedData.join(", ")}. NÃO peça esses dados novamente.`,
      });
    }

    if (missingData.length > 0 && context.leadName && !isFirstMessage) {
      const inMsgCount = context.messageHistory.filter(m => m.direction === "in").length;
      if (inMsgCount >= 4) {
        messages.push({
          role: "system",
          content: `URGENTE: Ainda FALTA coletar: ${missingData.join(" e ")}. Já são ${inMsgCount + 1} mensagens do cliente e esses dados ainda não foram coletados. PEÇA AGORA de forma simpática mas direta. Ex: "Ah, me passa seu email pra eu te enviar as informações? E de qual cidade você é? 📩". NÃO adie mais.`,
        });
      } else if (inMsgCount >= 2) {
        messages.push({
          role: "system",
          content: `Ainda FALTA coletar: ${missingData.join(" e ")}. Aproveite esta resposta para pedir de forma natural. Ex: "Me passa seu email e de qual cidade você é? Assim consigo te enviar tudo certinho 📩". Pode pedir junto ou separado.`,
        });
      } else {
        messages.push({
          role: "system",
          content: `Dados que ainda faltam: ${missingData.join(" e ")}. Peça quando surgir um momento adequado na conversa.`,
        });
      }
    }

    // Adiciona histórico de mensagens (últimas 15)
    const recentHistory = context.messageHistory.slice(-15);
    for (const msg of recentHistory) {
      if (msg.body) {
        messages.push({
          role: msg.direction === "in" ? "user" : "assistant",
          content: msg.body,
        });
      }
    }

    // Adiciona a mensagem atual
    messages.push({ role: "user", content: userMessage });

    const model = settings.openaiModel || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 350,
      temperature: 0.85,
      presence_penalty: 0.3,
      frequency_penalty: 0.25,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return { response: generateFallbackResponse(userMessage, context.leadName) };
    }

    // Tenta extrair nome, email e cidade da mensagem do usuário
    const extractedData = extractLeadData(userMessage, context);

    // Atualiza o lead no banco se encontrou dados novos
    if (extractedData.name || extractedData.email || extractedData.city) {
      await updateLeadData(context.leadId, extractedData);
    }

    return { response: response.trim(), extractedData };
  } catch (error) {
    console.error("Erro ao gerar resposta IA:", error);
    return { response: generateFallbackResponse(userMessage, context.leadName) };
  }
}

function extractLeadData(
  message: string,
  context: ConversationContext
): { name?: string; email?: string; city?: string } {
  const result: { name?: string; email?: string; city?: string } = {};

  // Extrai email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = message.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // Extrai cidade
  if (!context.leadCity) {
    const cityPatterns = [
      /(?:sou de|moro em|moro no|moro na|estou em|tô em|to em|fico em|resido em|cidade[:\s]+)\s*([A-ZÀ-Úa-zà-ú][a-zà-ú]+(?:\s+(?:do|da|de|dos|das|e)\s+)?(?:[A-ZÀ-Úa-zà-ú][a-zà-ú]+)?)/i,
      /(?:aqui (?:em|no|na))\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:do|da|de|dos|das|e)\s+)?(?:[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    ];
    for (const pattern of cityPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const city = match[1].trim();
        if (city.length >= 3 && !/\d/.test(city)) {
          result.city = city;
          break;
        }
      }
    }
  }

  // Extrai nome: padrões explícitos + fallback para respostas curtas (quando bot perguntou o nome)
  if (!context.leadName) {
    const msg = message.trim();
    
    // Palavras comuns que NÃO são nomes de pessoa
    const NOT_NAMES = new Set([
      "vi", "sulma", "sim", "não", "nao", "oi", "ola", "olá", "ok", "então", "entao",
      "quanto", "custa", "qual", "valor", "preço", "preco", "plano", "planos",
      "me", "explica", "explicar", "como", "funciona", "quero", "saber", "mais",
      "pode", "gostaria", "tenho", "interesse", "informação", "informacao",
      "por", "favor", "bom", "dia", "boa", "tarde", "noite", "obrigado", "obrigada",
      "valeu", "tudo", "bem", "tá", "ta", "to", "tô", "aqui", "isso", "esse",
      "essa", "tem", "ter", "ser", "uma", "uns", "dos", "das", "para", "pra",
      "saúde", "saude", "exame", "exames", "consulta", "consultas", "médico",
      "medico", "clínica", "clinica", "hospital", "atendente", "humano",
      "whatsapp", "mensagem", "obrigado", "brigado", "brigada",
    ]);

    // 1. Padrões explícitos de identificação
    const namePatterns = [
      /(?:me chamo|meu nome é|meu nome e|sou o|sou a|pode me chamar de|chamo|é o|é a)\s+([A-ZÀ-Úa-zà-ú][a-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú][a-zà-ú]+){0,2})/i,
    ];

    for (const pattern of namePatterns) {
      const match = msg.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim();
        const lowerWords = potentialName.toLowerCase().split(/\s+/);
        if (
          potentialName.length >= 2 &&
          !/\d/.test(potentialName) &&
          !lowerWords.some((w) => NOT_NAMES.has(w))
        ) {
          result.name = potentialName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          break;
        }
      }
    }

    // 2. Fallback: se a última msg do bot perguntou o nome e a resposta é curta (1-3 palavras)
    if (!result.name) {
      const lastBotMsg = context.messageHistory
        .filter(m => m.direction === "out" && m.body)
        .pop()?.body?.toLowerCase() || "";
      const botAskedForName = lastBotMsg.includes("chamar") ||
        lastBotMsg.includes("seu nome") ||
        lastBotMsg.includes("quem fala") ||
        lastBotMsg.includes("como posso te chamar") ||
        lastBotMsg.includes("qual seu nome") ||
        lastBotMsg.includes("qual o seu nome");

      if (botAskedForName) {
        // Remove saudações e pontuação da resposta
        const cleaned = msg
          .replace(/^(oi|olá|ola|hey|eai|e ai|bom dia|boa tarde|boa noite)[,!.\s]*/i, "")
          .replace(/[!.,?]+$/g, "")
          .trim();
        const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

        if (words.length >= 1 && words.length <= 3) {
          const allValid = words.every(w => 
            /^[A-ZÀ-Úa-zà-ú]+$/.test(w) && !NOT_NAMES.has(w.toLowerCase())
          );
          if (allValid) {
            result.name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          }
        }
      }
    }
  }

  return result;
}

async function updateLeadData(
  leadId: string,
  data: { name?: string; email?: string; city?: string }
) {
  try {
    const updateData: { name?: string; email?: string; city?: string } = {};

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.city) updateData.city = data.city;

    // Atualiza apenas nome/email; status segue o fluxo NOVO → EM_ATENDIMENTO → QUALIFICADO
    if (Object.keys(updateData).length > 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });
      console.log(`Lead ${leadId} atualizado:`, updateData);
    }
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
  }
}

function generateFallbackResponse(text: string, leadName?: string | null): string {
  const t = text.toLowerCase();
  const greeting = leadName ? `${leadName}` : "";

  if (t.match(/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e ai|eai)/)) {
    return `Olá! 👋 Eu sou a Sulma, consultora de saúde do Amo Vidas. Como posso te chamar?`;
  }

  if (t.includes("plano") || t.includes("valor") || t.includes("preço")) {
    return `${greeting ? greeting + ", t" : "T"}emos 3 planos: Plano Rotina (R$ 37,90), Plano Especializado (R$ 57,90) e Cobertura Total (R$ 97,00). O foco é cuidado de rotina ou exames mais específicos?`;
  }

  if (t.includes("amo vidas") || t.includes("o que é")) {
    return `Amo Vidas é um clube de benefícios em saúde, com assinatura mensal, que dá acesso a consultas, exames e descontos. ${greeting ? greeting + ", v" : "V"}ocê busca rotina ou exames mais específicos?`;
  }

  if (t.includes("obrigado") || t.includes("obrigada") || t.includes("valeu")) {
    return `Imagina${greeting ? ", " + greeting : ""}! 😊 Se precisar de mais alguma coisa, é só chamar. Tenha um ótimo dia! 🌟`;
  }

  if (!leadName) {
    return `Olá! Sou a Sulma, consultora do Amo Vidas. Antes de continuar, como posso te chamar? 😊`;
  }

  return `${greeting}, entendi! Me conta mais sobre o que você precisa que eu te ajudo. Se preferir falar com uma pessoa, é só me avisar! 😊`;
}

export function shouldTransferToHuman(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = [
    "atendente",
    "humano",
    "pessoa real",
    "falar com alguem",
    "falar com alguém",
    "quero falar",
    "preciso falar",
    "gerente",
    "reclamação",
    "cancelar",
    // cobrança/negociação → atendente humano
    "parcelar",
    "parcelamento",
    "negociar",
    "negociação",
    "acordo",
    "desconto",
    "não devo",
    "nao devo",
    "não reconheço",
    "nao reconheco",
    "já paguei",
    "ja paguei",
  ];
  return keywords.some((k) => t.includes(k));
}

/**
 * Detecta a etapa do funil baseada no contexto da conversa
 * Retorna o status sugerido para o lead
 */
export function detectLeadStatus(
  messageHistory: { direction: string; body: string | null }[],
  currentMessage: string,
  currentStatus: string
): string | null {
  const allMessages = messageHistory
    .filter((m) => m.body)
    .map((m) => m.body!.toLowerCase())
    .join(" ");
  const msg = currentMessage.toLowerCase();
  const combined = `${allMessages} ${msg}`;

  // PERDIDO - Sinais de desistência ou não interesse
  const lostKeywords = [
    "não tenho interesse",
    "nao tenho interesse",
    "não quero",
    "nao quero",
    "não preciso",
    "nao preciso",
    "desisto",
    "deixa pra lá",
    "deixa pra la",
    "esquece",
    "não é pra mim",
    "nao e pra mim",
    "muito caro",
    "sem condições",
    "sem condicoes",
    "não posso pagar",
    "nao posso pagar",
    "já comprei em outro lugar",
    "ja comprei em outro lugar",
    "já tenho",
    "ja tenho",
    "não me interessa",
    "nao me interessa",
  ];
  if (lostKeywords.some((k) => msg.includes(k))) {
    return "PERDIDO";
  }

  // FECHADO - Sinais de fechamento/compra
  const closedKeywords = [
    "vou comprar",
    "quero comprar",
    "fechar negócio",
    "fechar negocio",
    "vou fechar",
    "fechado",
    "pode mandar o pix",
    "manda o pix",
    "vou pagar",
    "quero pagar",
    "aceito",
    "vamos fechar",
    "combinado",
    "pode enviar",
    "manda o contrato",
    "vou assinar",
    "contrato assinado",
    "pagamento feito",
    "já paguei",
    "ja paguei",
    "paguei agora",
  ];
  if (closedKeywords.some((k) => msg.includes(k))) {
    return "FECHADO";
  }

  // QUALIFICADO - Somente quando demonstra interesse REAL em fechar/contratar um plano específico
  // Frases genéricas como "tenho interesse", "quero saber mais" NÃO qualificam
  const qualifiedKeywords = [
    "quero assinar",
    "quero contratar",
    "vou assinar",
    "quero o plano",
    "quero esse plano",
    "quero o rotina",
    "quero o especializado",
    "quero o cobertura total",
    "gostei do plano",
    "gostei do rotina",
    "gostei do especializado",
    "como faço pra assinar",
    "como faco pra assinar",
    "como assino",
    "me manda o link",
    "manda o link",
    "pode mandar o link",
    "quero fechar",
    "bora fechar",
    "vamos fechar",
    "formas de pagamento",
    "como pago",
    "aceito o plano",
    "pode ser esse",
    "vou querer",
    "quero esse",
  ];
  const hasQualifiedSignal = qualifiedKeywords.some((k) => msg.includes(k));
  if (hasQualifiedSignal && currentStatus !== "FECHADO") {
    return "QUALIFICADO";
  }

  // EM_ATENDIMENTO - lead que já interagiu significativamente (6+ mensagens no histórico = conversa avançou)
  // Antes disso permanece NOVO para o time de vendas identificar quem entrou e não engajou
  if (currentStatus === "NOVO" && messageHistory.length >= 6) {
    return "EM_ATENDIMENTO";
  }

  // LEAD_FRIO - Sinais de lead esfriando
  const coldKeywords = [
    "vou pensar",
    "preciso pensar",
    "depois eu vejo",
    "não sei se",
    "nao sei se",
    "talvez",
    "não agora",
    "nao agora",
    "mais tarde",
    "outro dia",
    "semana que vem",
    "mês que vem",
    "mes que vem",
    "não é o momento",
    "nao e o momento",
    "vou analisar",
    "deixa eu ver",
  ];
  if (coldKeywords.some((k) => msg.includes(k))) {
    return "LEAD_FRIO";
  }

  return null; // Mantém o status atual
}

/**
 * Gera um resumo curto da conversa para a aba Anotações
 * Chamado a cada N mensagens ou quando há dados novos relevantes
 */
export async function generateConversationSummary(
  messageHistory: { direction: string; body: string | null }[],
  leadName: string | null
): Promise<string | null> {
  try {
    const openai = await getOpenAIClient();
    if (!openai) return null;

    const msgs = messageHistory
      .filter((m) => m.body)
      .map((m) => `${m.direction === "in" ? "Cliente" : "Sulma"}: ${m.body}`)
      .join("\n");

    if (!msgs.trim()) return null;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Resuma a conversa abaixo em português (pt-BR), de forma objetiva, em no máximo 5 linhas.
Inclua: o que o cliente busca, planos/serviços mencionados, objeções, dados coletados (nome, email, cidade), e o status atual da negociação.
Use formato de tópicos curtos. Não invente dados que não estejam na conversa.
${leadName ? `Nome do cliente: ${leadName}` : ""}`,
        },
        {
          role: "user",
          content: msgs,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    return null;
  }
}
