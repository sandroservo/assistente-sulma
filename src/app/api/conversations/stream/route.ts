import { onConversationUpdate } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE: empurra atualizações do inbox pro painel em tempo real.
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* conexão fechada */
        }
      };

      send({ type: "ready" });

      const unsub = onConversationUpdate((evt) => send(evt));

      // Heartbeat pra manter a conexão viva através de proxies.
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 25000);

      // Cleanup quando o cliente desconecta.
      const signal: AbortSignal | undefined = (controller as unknown as { signal?: AbortSignal }).signal;
      const cleanup = () => {
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      signal?.addEventListener?.("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: não bufferizar SSE
    },
  });
}
