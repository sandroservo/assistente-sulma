/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Componente de ações do lead na sidebar do Inbox
 * Inclui: Salvar nome, adicionar lembrete, gerenciar tags
 */

"use client";

import { useState } from "react";
import {
    Bell,
    Tag as TagIcon,
    Pencil,
    Loader2,
    X,
    Plus,
    Check,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface LeadActionsProps {
    leadId: string;
    leadName: string | null;
    leadTags?: Tag[];
    organizationId: string;
    onNameUpdate?: (name: string) => void;
}

export default function LeadActions({
    leadId,
    leadName,
    leadTags = [],
    organizationId,
    onNameUpdate
}: LeadActionsProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(leadName || "");
    const [isSavingName, setIsSavingName] = useState(false);

    const [showReminderModal, setShowReminderModal] = useState(false);
    const [reminderDate, setReminderDate] = useState("");
    const [reminderNote, setReminderNote] = useState("");
    const [isSavingReminder, setIsSavingReminder] = useState(false);

    const [showTagModal, setShowTagModal] = useState(false);
    const [tags, setTags] = useState<Tag[]>(leadTags);
    const [newTagName, setNewTagName] = useState("");
    const [isSavingTag, setIsSavingTag] = useState(false);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editingTagName, setEditingTagName] = useState("");

    const handleSaveName = async () => {
        if (!name.trim()) return;
        setIsSavingName(true);
        try {
            const res = await fetch(`/api/leads/${leadId}/update`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (res.ok) {
                setIsEditingName(false);
                onNameUpdate?.(name.trim());
            }
        } catch (error) {
            console.error("Erro ao salvar nome:", error);
        } finally {
            setIsSavingName(false);
        }
    };

    const handleAddReminder = async () => {
        if (!reminderDate) return;
        setIsSavingReminder(true);
        try {
            const res = await fetch(`/api/leads/${leadId}/reminders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scheduledAt: reminderDate,
                    note: reminderNote
                }),
            });
            if (res.ok) {
                setShowReminderModal(false);
                setReminderDate("");
                setReminderNote("");
                // TODO: Show success toast
            }
        } catch (error) {
            console.error("Erro ao criar lembrete:", error);
        } finally {
            setIsSavingReminder(false);
        }
    };

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        setIsSavingTag(true);
        try {
            // First create or get the tag
            const tagRes = await fetch("/api/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTagName.trim(),
                    organizationId,
                }),
            });

            if (tagRes.ok) {
                const { tag } = await tagRes.json();

                // Then add to lead
                const leadRes = await fetch(`/api/leads/${leadId}/tags`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tagId: tag.id }),
                });

                if (leadRes.ok) {
                    setTags(prev => [...prev, tag]);
                    setNewTagName("");
                }
            }
        } catch (error) {
            console.error("Erro ao adicionar tag:", error);
        } finally {
            setIsSavingTag(false);
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        try {
            const res = await fetch(`/api/leads/${leadId}/tags?tagId=${tagId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setTags(prev => prev.filter(t => t.id !== tagId));
            }
        } catch (error) {
            console.error("Erro ao remover tag:", error);
        }
    };

    // Renomeia a etiqueta na organização (afeta todos os leads).
    const handleRenameTag = async (tagId: string) => {
        const name = editingTagName.trim();
        if (!name) return;
        try {
            const res = await fetch(`/api/tags/${tagId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                setTags(prev => prev.map(t => (t.id === tagId ? { ...t, name } : t)));
                setEditingTagId(null);
                setEditingTagName("");
            }
        } catch (error) {
            console.error("Erro ao renomear etiqueta:", error);
        }
    };

    // Apaga a etiqueta da organização (remove de todos os leads).
    const handleDeleteTag = async (tagId: string) => {
        if (!confirm("Apagar esta etiqueta de toda a organização?")) return;
        try {
            const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
            if (res.ok) {
                setTags(prev => prev.filter(t => t.id !== tagId));
            }
        } catch (error) {
            console.error("Erro ao apagar etiqueta:", error);
        }
    };

    return (
        <>
            <div className="space-y-3">
                {/* Salvar Nome */}
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Ações</p>

                    {isEditingName ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm border rounded-md"
                                placeholder="Nome do contato"
                                autoFocus
                            />
                            <Button
                                size="sm"
                                onClick={handleSaveName}
                                disabled={isSavingName}
                                className="px-2"
                            >
                                {isSavingName ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsEditingName(false)}
                                className="px-2"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2"
                            onClick={() => setIsEditingName(true)}
                        >
                            <Pencil className="h-4 w-4" />
                            Salvar Nome
                        </Button>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setShowReminderModal(true)}
                >
                    <Bell className="h-4 w-4" />
                    Adicionar Lembrete
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setShowTagModal(true)}
                >
                    <TagIcon className="h-4 w-4" />
                    Gerenciar Etiquetas
                </Button>

                {/* Tags atuais */}
                {tags.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Etiquetas</p>
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                                        style={{
                                            backgroundColor: `${tag.color}20`,
                                            color: tag.color
                                        }}
                                    >
                                        {tag.name}
                                        <button
                                            onClick={() => handleRemoveTag(tag.id)}
                                            className="hover:opacity-70"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal de Lembrete */}
            {showReminderModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Adicionar Lembrete</h3>
                            <button
                                onClick={() => setShowReminderModal(false)}
                                className="p-1 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Data e Hora</label>
                                <input
                                    type="datetime-local"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nota (opcional)</label>
                                <textarea
                                    value={reminderNote}
                                    onChange={(e) => setReminderNote(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg resize-none"
                                    rows={3}
                                    placeholder="Adicione uma nota..."
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowReminderModal(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAddReminder}
                                    disabled={isSavingReminder || !reminderDate}
                                    className="flex-1"
                                >
                                    {isSavingReminder ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Tags */}
            {showTagModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Gerenciar Etiquetas</h3>
                            <button
                                onClick={() => setShowTagModal(false)}
                                className="p-1 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="Nova etiqueta..."
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />
                                <Button
                                    onClick={handleAddTag}
                                    disabled={isSavingTag || !newTagName.trim()}
                                >
                                    {isSavingTag ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {tags.length > 0 && (
                                <div className="space-y-1.5">
                                    {tags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border"
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                            {editingTagId === tag.id ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editingTagName}
                                                        onChange={(e) => setEditingTagName(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameTag(tag.id); if (e.key === "Escape") setEditingTagId(null); }}
                                                        className="flex-1 min-w-0 px-2 py-0.5 text-sm border rounded"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleRenameTag(tag.id)} className="p-1 text-green-600 hover:bg-gray-100 rounded" title="Salvar">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={() => setEditingTagId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancelar">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="flex-1 min-w-0 truncate text-sm" style={{ color: tag.color }}>{tag.name}</span>
                                                    <button
                                                        onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}
                                                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                                                        title="Renomear etiqueta"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveTag(tag.id)}
                                                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                                                        title="Remover deste lead"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTag(tag.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                                                        title="Apagar etiqueta da organização"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => setShowTagModal(false)}
                                className="w-full"
                            >
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
