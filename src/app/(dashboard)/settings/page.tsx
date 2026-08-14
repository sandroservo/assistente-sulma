/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { getSystemSettings } from "@/lib/settings";
import { SettingsForm } from "./ui/SettingsForm";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getDefaultSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "agent", "systemprompt.md");
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return "";
  }
}

export default async function SettingsPage() {
  const settings = await getSystemSettings();
  const defaultSystemPrompt = getDefaultSystemPrompt();

  // Mascara tokens sensíveis para exibição; demais vêm do banco
  const maskedSettings = {
    ...settings,
    evolutionToken: settings.evolutionToken ? "••••••••" : "",
    webhookSecret: settings.webhookSecret ? "••••••••" : "",
    openaiApiKey: settings.openaiApiKey ? "••••••••" : "",
    openaiModel: settings.openaiModel || "gpt-4o-mini",
    appUrl: settings.appUrl || "",
  };

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-4 md:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">
          Gerencie as configurações do sistema
        </p>
      </div>

      <SettingsForm
        settings={maskedSettings}
        defaultSystemPrompt={defaultSystemPrompt}
      />
    </div>
  );
}
