/**
 * Wrapper Client Component para o LeadsKanban
 * Evita erros de hidratação renderizando apenas no cliente
 */
"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LeadsKanban } from "./LeadsKanban";

interface Lead {
    id: string;
    name: string | null;
    pushName: string | null;
    phone: string;
    status: string;
    ownerType: string;
    category: string;
    summary: string | null;
    priority: string;
    source: string;
    leadScore: number;
    updatedAt: string;
    createdAt: string;
    conversationId: string | null;
    tags: { id: string; name: string; color: string }[];
    responsible: { name: string | null; avatar: string | null } | null;
}

interface LeadsKanbanWrapperProps {
    initialLeads: Lead[];
    initialHasMore?: boolean;
}

export function LeadsKanbanWrapper({ initialLeads, initialHasMore = false }: LeadsKanbanWrapperProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className="flex items-center justify-center p-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                <span className="text-lg">Carregando Kanban...</span>
            </div>
        );
    }

    return <LeadsKanban initialLeads={initialLeads} initialHasMore={initialHasMore} />;
}
