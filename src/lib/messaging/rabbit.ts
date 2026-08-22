/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Connection manager RabbitMQ: conexão lazy, ConfirmChannel, reconexão após
 * queda do broker e fechamento gracioso. Publica sempre persistent + confirm.
 */

import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { assertCampaignTopology } from "./topology";

const URL = () => process.env.RABBITMQ_URL || "amqp://guest:guest@127.0.0.1:5672";
const PUBLISH_TIMEOUT = () => Number(process.env.RABBITMQ_PUBLISH_TIMEOUT_MS || 10_000);

let conn: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;
let connecting: Promise<ConfirmChannel> | null = null;

function reset() {
  conn = null;
  channel = null;
  connecting = null;
}

async function connect(): Promise<ConfirmChannel> {
  const c = await amqp.connect(URL());
  c.on("error", (e) => console.error(JSON.stringify({ service: "rabbit", event: "conn_error", err: String(e?.message ?? e) })));
  c.on("close", () => {
    console.warn(JSON.stringify({ service: "rabbit", event: "conn_close" }));
    reset();
  });
  const ch = await c.createConfirmChannel();
  ch.on("error", (e) => console.error(JSON.stringify({ service: "rabbit", event: "channel_error", err: String(e?.message ?? e) })));
  await assertCampaignTopology(ch);
  conn = c;
  channel = ch;
  return ch;
}

/** Canal confirm pronto (topologia já declarada). Reconecta se necessário. */
export async function getConfirmChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;
  if (connecting) return connecting;
  connecting = connect().finally(() => { connecting = null; });
  return connecting;
}

/**
 * Publica persistent num exchange e AGUARDA o confirm do broker.
 * Rejeita em nack ou timeout — o chamador só marca queued após resolver.
 */
export async function publishConfirm(
  exchange: string,
  routingKey: string,
  job: unknown,
  options: { messageId: string; correlationId: string; type: string; attempt: number }
): Promise<void> {
  const ch = await getConfirmChannel();
  const body = Buffer.from(JSON.stringify(job));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("publish confirm timeout")), PUBLISH_TIMEOUT());
    ch.publish(
      exchange,
      routingKey,
      body,
      {
        persistent: true,
        contentType: "application/json",
        messageId: options.messageId,
        correlationId: options.correlationId,
        type: options.type,
        headers: { "x-event-version": 1, "x-attempt": options.attempt },
      },
      (err) => {
        clearTimeout(timer);
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      }
    );
  });
}

/** Publica direto numa fila (usado para rotear a retry queues). */
export async function sendToQueueConfirm(
  queue: string,
  job: unknown,
  options: { messageId: string; correlationId: string; type: string; attempt: number }
): Promise<void> {
  const ch = await getConfirmChannel();
  const body = Buffer.from(JSON.stringify(job));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("publish confirm timeout")), PUBLISH_TIMEOUT());
    ch.sendToQueue(
      queue,
      body,
      {
        persistent: true,
        contentType: "application/json",
        messageId: options.messageId,
        correlationId: options.correlationId,
        type: options.type,
        headers: { "x-event-version": 1, "x-attempt": options.attempt },
      },
      (err) => {
        clearTimeout(timer);
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      }
    );
  });
}

export async function closeRabbit(): Promise<void> {
  try {
    await channel?.close();
    await conn?.close();
  } catch {
    // já caiu
  } finally {
    reset();
  }
}
