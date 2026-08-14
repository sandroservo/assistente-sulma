/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para popular base de conhecimento com dados iniciais
 */

import { NextResponse } from "next/server";
import { createKnowledge } from "@/lib/knowledge";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const INITIAL_KNOWLEDGE = [
  {
    category: "planos",
    title: "Plano Essencial",
    content: `Valor: R$ 37,90/mês

Benefícios:
- Consultas com clínico geral
- Check-up básico anual (182 exames)
- Descontos em farmácias parceiras

Ideal para: Pessoas que buscam cuidado de rotina e prevenção básica.`,
    keywords: "essencial, básico, 37,90, clínico geral, 182 exames",
    priority: 10,
  },
  {
    category: "planos",
    title: "Plano Completo",
    content: `Valor: R$ 59,90/mês

Benefícios:
- Tudo do Essencial +
- Consultas com especialistas
- Check-up completo (1.000 exames)
- Telemedicina 24h

Ideal para: Pessoas que precisam de acompanhamento com especialistas.`,
    keywords: "completo, 59,90, especialistas, telemedicina, 1000 exames",
    priority: 10,
  },
  {
    category: "planos",
    title: "Plano Premium",
    content: `Valor: R$ 99,90/mês

Benefícios:
- Tudo do Completo +
- Check-up premium (5.000 exames)
- Até 4 dependentes inclusos
- Descontos em academias

Ideal para: Famílias que querem cobertura completa.`,
    keywords: "premium, 99,90, dependentes, família, 5000 exames, academia",
    priority: 10,
  },
  {
    category: "regras",
    title: "Carência",
    content: `Períodos de carência:
- 30 dias para consultas
- 90 dias para exames

A carência começa a contar a partir da data de adesão.`,
    keywords: "carência, prazo, 30 dias, 90 dias, espera",
    priority: 8,
  },
  {
    category: "regras",
    title: "Permanência Mínima",
    content: `Permanência mínima: 12 meses

O associado deve permanecer por pelo menos 12 meses no clube.`,
    keywords: "permanência, fidelidade, 12 meses, contrato",
    priority: 8,
  },
  {
    category: "regras",
    title: "O que NÃO cobre",
    content: `O Amo Vidas é um clube de benefícios focado em ROTINA e PREVENÇÃO.

NÃO COBRE:
- Urgência
- Emergência
- Internação hospitalar

Foque nos benefícios de consultas, exames e check-ups para prevenção.`,
    keywords: "não cobre, urgência, emergência, hospital, internação",
    priority: 9,
  },
  {
    category: "regras",
    title: "Idade",
    content: `Pessoas com 60 anos ou mais podem aderir normalmente, sem restrição de idade.`,
    keywords: "60 anos, idoso, terceira idade, sem restrição",
    priority: 7,
  },
  {
    category: "pagamento",
    title: "Formas de Pagamento",
    content: `Formas de pagamento aceitas:
- Pix
- Cartão de crédito

O pagamento é mensal e recorrente.`,
    keywords: "pix, cartão, crédito, pagamento, mensal",
    priority: 8,
  },
  {
    category: "links",
    title: "Links Oficiais",
    content: `Links para enviar ao cliente:

Benefícios (geral): https://amovidas.com.br/beneficios

Checkout Essencial: https://amovidas.com.br/assinar/essencial
Checkout Completo: https://amovidas.com.br/assinar/completo
Checkout Premium: https://amovidas.com.br/assinar/premium`,
    keywords: "link, checkout, assinar, benefícios, site",
    priority: 9,
  },
  {
    category: "check-ups",
    title: "Check-ups Disponíveis",
    content: `Check-ups por plano:

- Essencial: 182 exames (check-up básico anual)
- Completo: 1.000 exames (check-up completo)
- Premium: 5.000 exames (check-up premium)

Os check-ups incluem exames de sangue, imagem e outros conforme o plano.`,
    keywords: "check-up, exames, 182, 1000, 5000, sangue, imagem",
    priority: 8,
  },
  {
    category: "faq",
    title: "O que é o Amo Vidas?",
    content: `Amo Vidas é um clube de benefícios em saúde, com assinatura mensal, que dá acesso a consultas, exames e descontos na rede credenciada conforme o plano escolhido.

Foco em prevenção e cuidado de rotina.`,
    keywords: "o que é, amo vidas, clube, benefícios",
    priority: 7,
  },
];

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;

    // Verifica se já existem conhecimentos
    const count = await prisma.knowledge.count({
      where: { organizationId },
    });
    
    if (count > 0) {
      return NextResponse.json({
        ok: false,
        message: "Base de conhecimento já possui dados. Delete os existentes primeiro.",
        count,
      });
    }

    // Cria os conhecimentos iniciais
    for (const item of INITIAL_KNOWLEDGE) {
      await createKnowledge({ ...item, organizationId });
    }

    return NextResponse.json({
      ok: true,
      message: `${INITIAL_KNOWLEDGE.length} conhecimentos criados com sucesso`,
    });
  } catch (error) {
    console.error("Erro ao popular conhecimentos:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao popular conhecimentos" },
      { status: 500 }
    );
  }
}
