/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ChatsPage() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full bg-gray-50/50">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-[#E8EDF8] flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-10 w-10 text-[#F9A825]" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Selecione uma conversa
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Escolha uma conversa na lista ao lado para iniciar o atendimento
        </p>
      </div>
    </div>
  );
}
