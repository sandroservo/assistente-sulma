/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  Loader2, 
  Wifi, 
  Key, 
  Bot,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Link,
  UserMinus,
  Layers,
  Tag as TagIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExcludedContactsCard } from "./ExcludedContactsCard";
import { SectorsCard } from "./SectorsCard";
import { TagsCard } from "./TagsCard";
import InstancesManager from "@/app/(dashboard)/instances/ui/InstancesManager";

const WEBHOOK_PATH = "/api/asaas/webhook";

function AsaasWebhookUrlCopy() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}${WEBHOOK_PATH}`
    : `https://seu-dominio.com${WEBHOOK_PATH}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>URL para colar no Asaas</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          className="bg-muted font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title="Copiar URL"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Copie esta URL e cole nas configurações de webhook do Asaas (Integrações → Webhooks).
      </p>
    </div>
  );
}

interface SettingsFormProps {
  settings: {
    evolutionBaseUrl: string;
    evolutionInstance: string;
    evolutionToken: string;
    webhookSecret: string;
    openaiApiKey: string;
    openaiModel: string;
    systemPrompt: string;
    asaasWebhookUrl: string;
    n8nTranscribeWebhook: string;
    appUrl: string;
  };
  defaultSystemPrompt: string;
}

export function SettingsForm({ settings, defaultSystemPrompt }: SettingsFormProps) {
  const [formData, setFormData] = useState(settings);
  const [tab, setTab] = useState("evolution");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = formData.appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrlDisplay = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/webhooks/evolution` : "";

  async function copyWebhookUrl() {
    const url = webhookUrlDisplay || (typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/evolution` : "");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Configurações salvas com sucesso!" });
      } else {
        setMessage({ type: "error", text: "Erro ao salvar configurações" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao salvar configurações" });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: string, value: string) {
    setFormData({ ...formData, [field]: value });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Evolution
          </TabsTrigger>
          <TabsTrigger value="openai" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            OpenAI
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Exceções
          </TabsTrigger>
          <TabsTrigger value="prompt" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Prompt
          </TabsTrigger>
          <TabsTrigger value="sectors" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Setores
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            Etiquetas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações gerais</CardTitle>
              <CardDescription>
                URL da aplicação usada em webhooks e links (Evolution, Asaas, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appUrl">URL da aplicação</Label>
                <Input
                  id="appUrl"
                  value={formData.appUrl}
                  onChange={(e) => handleChange("appUrl", e.target.value)}
                  placeholder="https://seu-dominio.com"
                />
                <p className="text-xs text-gray-500">
                  URL pública do painel, acessível pela Evolution (não use localhost). Ex.: https://sulma.seudominio.com.
                  Sem isso, as mensagens do WhatsApp não chegam no chat.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolution API</CardTitle>
              <CardDescription>
                URL e token globais. As instâncias WhatsApp são criadas abaixo, nesta mesma aba.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolutionBaseUrl">URL Base</Label>
                <Input
                  id="evolutionBaseUrl"
                  value={formData.evolutionBaseUrl}
                  onChange={(e) => handleChange("evolutionBaseUrl", e.target.value)}
                  placeholder="https://evolution.seudominio.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolutionToken">Token da API</Label>
                <Input
                  id="evolutionToken"
                  type="password"
                  value={formData.evolutionToken}
                  onChange={(e) => handleChange("evolutionToken", e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                <Input
                  id="webhookSecret"
                  type="password"
                  value={formData.webhookSecret}
                  onChange={(e) => handleChange("webhookSecret", e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>URL do Webhook (Evolution API)</Label>
                <div className="flex gap-2">
                <Input
                  value={webhookUrlDisplay || "Configure a URL da aplicação na aba Geral"}
                  readOnly
                  className="bg-gray-50 font-mono text-sm"
                />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyWebhookUrl}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Configure esta URL no webhook da Evolution API para receber mensagens
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#001A5E] hover:bg-[#003080]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar URL e token
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <InstancesManager embedded />
        </TabsContent>

        <TabsContent value="openai" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da OpenAI</CardTitle>
              <CardDescription>
                Configure a chave de API da OpenAI para a Sulma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={formData.openaiApiKey}
                  onChange={(e) => handleChange("openaiApiKey", e.target.value)}
                  placeholder="sk-••••••••••••••••"
                />
                <p className="text-xs text-gray-500">
                  Obtenha sua chave em{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#001A5E] hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openaiModel">Modelo</Label>
                <Input
                  id="openaiModel"
                  value={formData.openaiModel}
                  onChange={(e) => handleChange("openaiModel", e.target.value)}
                  placeholder="gpt-4o-mini"
                />
                <p className="text-xs text-gray-500">
                  Modelo usado pela Sulma (ex.: gpt-4o-mini, gpt-4o). Deixe em branco para usar gpt-4o-mini.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 pt-4">
          <ExcludedContactsCard />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integração com n8n</CardTitle>
              <CardDescription>
                Configure o webhook do n8n para transcrição de áudio (Whisper)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n8nTranscribeWebhook">URL do Webhook de Transcrição</Label>
                <Input
                  id="n8nTranscribeWebhook"
                  value={formData.n8nTranscribeWebhook}
                  onChange={(e) => handleChange("n8nTranscribeWebhook", e.target.value)}
                  placeholder="https://n8n.amovidas.com.br/webhook/transcribe"
                />
                <p className="text-xs text-gray-500">
                  Webhook do n8n que processa áudio com OpenAI Whisper e retorna a transcrição.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integração com Asaas</CardTitle>
              <CardDescription>
                Configure o webhook do Asaas para monitorar pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AsaasWebhookUrlCopy />
              <div className="space-y-2">
                <Label htmlFor="asaasWebhookUrl">URL do Webhook Asaas (opcional)</Label>
                <Input
                  id="asaasWebhookUrl"
                  value={formData.asaasWebhookUrl}
                  onChange={(e) => handleChange("asaasWebhookUrl", e.target.value)}
                  placeholder="https://seu-dominio.com/api/asaas/webhook"
                />
                <p className="text-xs text-gray-500">
                  Pode salvar aqui a mesma URL que configurou no Asaas (apenas referência).
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-gray-700">Eventos monitorados:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✅ <strong>PAYMENT_CONFIRMED</strong> - Marca lead como FECHADO</li>
                  <li>✅ <strong>PAYMENT_RECEIVED</strong> - Marca lead como FECHADO</li>
                  <li>⚠️ <strong>PAYMENT_OVERDUE</strong> - Envia lembrete ao lead</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt da Sulma</CardTitle>
              <CardDescription>
                Configure a personalidade e comportamento da Sulma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt || defaultSystemPrompt}
                  onChange={(e) => handleChange("systemPrompt", e.target.value)}
                  placeholder="Você é a Sulma, assistente virtual..."
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Deixe vazio para usar o prompt padrão do arquivo agent/systemprompt.md
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleChange("systemPrompt", "")}
                className="text-sm"
              >
                Restaurar Padrão
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sectors" className="pt-4">
          <SectorsCard />
        </TabsContent>

        <TabsContent value="tags" className="pt-4">
          <TagsCard />
        </TabsContent>
      </Tabs>

      {/* Setores/Etiquetas têm salvamento próprio — botão só nas abas de config do sistema */}
      {tab !== "sectors" && tab !== "tags" && tab !== "evolution" && (
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#001A5E] hover:bg-[#003080]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
