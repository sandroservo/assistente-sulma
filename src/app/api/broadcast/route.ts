/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Disparo em massa com rotação aleatória de instâncias e anti-bloqueio Meta.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evolutionSendText, evolutionSendMedia, evolutionSendPresence } from "@/lib/evolution";
import {
  pickRandomInstance,
  computeDelay,
  recordSendSuccess,
  recordSendFailure,
  formatWait,
  type AntiBlockProfile,
} from "@/lib/anti-block";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface BroadcastContact {
  phone: string;
  name: string;
}

interface BroadcastPayload {
  contacts: BroadcastContact[];
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
  instanceIds?: string[];
  profile?: AntiBlockProfile;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: BroadcastPayload = await req.json();
    const {
      contacts,
      message,
      imageBase64,
      imageMimeType,
      instanceIds,
      profile = "balanced",
    } = body;

    if (!contacts?.length || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Contatos e mensagem são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const safeProfile: AntiBlockProfile = ["conservative", "balanced", "aggressive"].includes(profile)
      ? profile
      : "balanced";

    const where = {
      organizationId: session.user.organizationId,
      status: "CONNECTED" as const,
      ...(instanceIds?.length ? { id: { in: instanceIds } } : {}),
    };

    let pool = await prisma.instance.findMany({ where });
    if (!pool.length) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma instância conectada. Crie e conecte WhatsApp em Instâncias.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const shuffled = [...contacts].sort(() => Math.random() - 0.5);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        send({
          type: "start",
          total: shuffled.length,
          instances: pool.length,
          profile: safeProfile,
          message: `Disparo para ${shuffled.length} contatos em ${pool.length} instância(s), perfil ${safeProfile}.`,
        });

        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < shuffled.length; i++) {
          const contact = shuffled[i];
          pool = await prisma.instance.findMany({ where });

          let picked = pickRandomInstance(pool, safeProfile);
          if (!picked) {
            send({
              type: "waiting",
              delay: 60_000,
              message: "Todas as instâncias no limite/pausa. Aguardando 60s...",
            });
            await sleep(60_000);
            pool = await prisma.instance.findMany({ where });
            picked = pickRandomInstance(pool, safeProfile);
          }

          if (!picked) {
            skipped++;
            send({
              type: "progress",
              index: i + 1,
              total: shuffled.length,
              sent,
              failed,
              skipped,
              contact: contact.name || contact.phone,
              status: "error",
              error: "Sem instância disponível (anti-bloqueio)",
            });
            continue;
          }

          try {
            await evolutionSendPresence(contact.phone, "composing", {
              instanceName: picked.instanceName,
              token: picked.token || undefined,
            }).catch(() => {});
            await sleep(800 + Math.random() * 1800);

            if (imageBase64) {
              await evolutionSendMedia({
                number: contact.phone,
                mediatype: "image",
                media: imageBase64,
                mimetype: imageMimeType || "image/jpeg",
                caption: message,
                instanceName: picked.instanceName,
                instanceToken: picked.token || undefined,
              });
            } else {
              await evolutionSendText({
                number: contact.phone,
                text: message,
                instanceName: picked.instanceName,
                instanceToken: picked.token || undefined,
              });
            }

            await recordSendSuccess(picked.id);
            sent++;
            send({
              type: "progress",
              index: i + 1,
              total: shuffled.length,
              sent,
              failed,
              skipped,
              contact: contact.name || contact.phone,
              instance: picked.name,
              status: "ok",
            });
          } catch (error) {
            failed++;
            const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
            const kind = await recordSendFailure(picked.id, errMsg);
            send({
              type: "progress",
              index: i + 1,
              total: shuffled.length,
              sent,
              failed,
              skipped,
              contact: contact.name || contact.phone,
              instance: picked.name,
              status: "error",
              error: kind === "blocked" ? "Instância pausada (risco de bloqueio)" : errMsg,
            });
          }

          if (i < shuffled.length - 1) {
            const delay = computeDelay(i, safeProfile);
            send({
              type: "waiting",
              delay,
              message: `Anti-bloqueio: aguardando ${formatWait(delay)}...`,
            });
            await sleep(delay);
          }
        }

        send({
          type: "done",
          sent,
          failed,
          skipped,
          total: shuffled.length,
          message: `Finalizado: ${sent} enviados, ${failed} falharam${skipped ? `, ${skipped} adiados` : ""}.`,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Broadcast] Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno no broadcast" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
