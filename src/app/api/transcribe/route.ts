/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para transcrição de áudio via n8n
 * Chama webhook do n8n que processa o áudio com OpenAI Whisper
 */

import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { audioUrl, messageId, mimeType } = body;

        if (!audioUrl) {
            return NextResponse.json(
                { error: "audioUrl é obrigatório" },
                { status: 400 }
            );
        }

        const settings = await getSystemSettings();
        const webhookUrl = settings.n8nTranscribeWebhook;

        if (!webhookUrl) {
            return NextResponse.json(
                {
                    error: "Webhook n8n não configurado",
                    message: "Configure o webhook de transcrição em Configurações → Integrações"
                },
                { status: 500 }
            );
        }

        // Chama o webhook do n8n
        const n8nResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                audioUrl,
                messageId,
                mimeType: mimeType || "audio/ogg",
                timestamp: new Date().toISOString(),
            }),
        });

        if (!n8nResponse.ok) {
            throw new Error(`n8n webhook error: ${n8nResponse.status}`);
        }

        const result = await n8nResponse.json();

        return NextResponse.json({
            success: true,
            transcription: result.transcription || result.text || "",
            messageId,
        });
    } catch (error) {
        console.error("Erro ao transcrever áudio:", error);
        return NextResponse.json(
            { error: "Erro ao transcrever áudio" },
            { status: 500 }
        );
    }
}
