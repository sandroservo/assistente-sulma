/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Composer melhorado: sem reload, gravação de áudio, envio de imagem/arquivo
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  Mic,
  Square,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Smile,
  LayoutGrid,
  Reply,
  Pencil,
  Contact,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSendError } from "@/lib/send-error";
import EmojiPicker from "@/components/chat/EmojiPicker";

interface ChatComposerProps {
  conversationId: string;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
}

interface ReplyMessage {
  id: string;
  body: string | null;
  direction: "in" | "out";
  sentByUserName?: string | null;
}

export default function ChatComposer({ conversationId, onToast }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCardsGallery, setShowCardsGallery] = useState(false);
  const [sendingCard, setSendingCard] = useState(false);
  const [showEmoticonsGallery, setShowEmoticonsGallery] = useState(false);
  const [sendingEmoticon, setSendingEmoticon] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ReplyMessage | null>(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [savedContacts, setSavedContacts] = useState<Array<{ id: string; name: string; phone: string; organization?: string }>>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [sendingContact, setSendingContact] = useState(false);
  const [infoCards, setInfoCards] = useState<Array<{ id: string; title: string; imageUrl: string }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Registra callbacks para comunicação com InboxConversation
  useEffect(() => {
    (window as any).__composerSetReply = (msg: ReplyMessage | null) => {
      setEditingMessage(null);
      setReplyingTo(msg);
      textareaRef.current?.focus();
    };
    (window as any).__composerSetEdit = (msg: ReplyMessage | null) => {
      setReplyingTo(null);
      setEditingMessage(msg);
      if (msg?.body) setText(msg.body);
      textareaRef.current?.focus();
    };
    return () => {
      delete (window as any).__composerSetReply;
      delete (window as any).__composerSetEdit;
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [text]);

  function handleEmojiSelect(emoji: string) {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setText((prev) => prev + emoji);
    }
  }

  function triggerRefetch() {
    if (typeof window !== "undefined" && (window as any).__inboxRefetch) {
      (window as any).__inboxRefetch();
    }
  }

  async function sendText() {
    if (!text.trim() || loading) return;

    // Modo edição: atualiza mensagem existente
    if (editingMessage) {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/${editingMessage.id}/edit`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          onToast?.(formatSendError(data.error || "Erro ao editar mensagem"), "error");
          return;
        }
        onToast?.("Mensagem editada", "success");
        setText("");
        setEditingMessage(null);
        triggerRefetch();
      } catch {
        onToast?.("Erro ao editar mensagem", "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    const outgoing = text.trim();
    const quotedId = replyingTo?.id;
    const tmpId = `tmp-${Date.now()}`;
    (window as any).__inboxAddOptimistic?.({
      id: tmpId,
      body: outgoing,
      type: "text",
      direction: "out",
      createdAt: new Date().toISOString(),
      status: "pending",
      quotedMessageId: quotedId || null,
    });
    setText("");
    setReplyingTo(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
    setLoading(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text: outgoing,
          quotedMessageId: quotedId || undefined,
        }),
      });

      if (!res.ok) {
        (window as any).__inboxRemoveOptimistic?.(tmpId);
        setText(outgoing);
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar a mensagem."), "error");
        return;
      }

      triggerRefetch();
    } catch (error) {
      (window as any).__inboxRemoveOptimistic?.(tmpId);
      setText(outgoing);
      console.error("Erro ao enviar:", error);
      onToast?.("Erro ao enviar mensagem", "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSavedContacts() {
    try {
      const res = await fetch("/api/contacts/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedContacts(data.contacts || []);
      }
    } catch {
      // silently fail
    }
  }

  async function sendSavedContact(contact: { name: string; phone: string; organization?: string }) {
    setSendingContact(true);
    try {
      const res = await fetch("/api/messages/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          contacts: [{
            fullName: contact.name,
            phoneNumber: contact.phone,
            organization: contact.organization || "",
          }],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar o contato."), "error");
        return;
      }
      onToast?.("Contato enviado", "success");
      setShowContactPicker(false);
      triggerRefetch();
    } catch {
      onToast?.("Erro ao enviar contato", "error");
    } finally {
      setSendingContact(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      onToast?.("Não foi possível acessar o microfone. Verifique as permissões.", "error");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream
          ?.getTracks()
          .forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sendAudio(blob: Blob) {
    setLoading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;

      const res = await fetch("/api/messages/send-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          base64,
          mimeType: "audio/ogg",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar o áudio."), "error");
        return;
      }

      triggerRefetch();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      onToast?.("Erro ao enviar áudio", "error");
    } finally {
      setLoading(false);
    }
  }

  // Emoticons oficiais Amo Vidas em public/emoticons/
  const availableEmoticons = [
    "7.png", "8.png", "11.png", "13.png", "15.png", "16.png",
    "17.png", "18.png", "20.png", "21.png", "22.png", "23.png",
    "Indiquei_-_Ganhei.png",
  ];

  async function sendEmoticon(file: string) {
    setSendingEmoticon(true);
    setShowEmoticonsGallery(false);
    try {
      const response = await fetch(`/emoticons/${file}`);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/messages/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, base64, mimeType: "image/png", fileName: file }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar o emoticon."), "error");
        return;
      }
      triggerRefetch();
    } catch {
      onToast?.("Erro ao enviar emoticon", "error");
    } finally {
      setSendingEmoticon(false);
    }
  }

  useEffect(() => {
    fetch("/api/info-cards")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.cards)) setInfoCards(d.cards);
      })
      .catch(() => {});
  }, []);

  async function sendCard(card: { title: string; imageUrl: string }) {
    setSendingCard(true);
    setShowCardsGallery(false);
    try {
      const response = await fetch(card.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/messages/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          base64,
          mimeType: blob.type || "image/jpeg",
          fileName: `${card.title}.jpg`,
          caption: card.title,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar o card."), "error");
        return;
      }

      triggerRefetch();
    } catch {
      onToast?.("Erro ao enviar card", "error");
    } finally {
      setSendingCard(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setAttachedPreview(url);
    } else {
      setAttachedPreview(null);
    }
    // Reset input
    e.target.value = "";
  }

  function clearAttachment() {
    setAttachedFile(null);
    if (attachedPreview) {
      URL.revokeObjectURL(attachedPreview);
      setAttachedPreview(null);
    }
  }

  async function sendFile() {
    if (!attachedFile || loading) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
      });
      reader.readAsDataURL(attachedFile);
      const base64 = await base64Promise;

      const res = await fetch("/api/messages/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          base64,
          mimeType: attachedFile.type,
          fileName: attachedFile.name,
          caption: text.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast?.(formatSendError(data.error || "Não foi possível enviar o arquivo."), "error");
        return;
      }

      clearAttachment();
      setText("");
      triggerRefetch();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      onToast?.("Erro ao enviar arquivo", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachedFile) {
        sendFile();
      } else {
        sendText();
      }
    }
  }

  function formatSeconds(s: number): string {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  // Recording mode
  if (isRecording) {
    return (
      <div className="bg-[#f0f2f5] border-t p-3 md:p-4">
        <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full hover:bg-red-50 text-red-500"
            onClick={cancelRecording}
            aria-label="Cancelar gravação"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-600">
              Gravando {formatSeconds(recordingTime)}
            </span>
          </div>
          <Button
            onClick={stopRecording}
            disabled={loading}
            size="icon"
            className="h-10 w-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] hover:from-[#003080] hover:to-[#001040] shadow-md"
            aria-label="Enviar áudio"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Reply bar */}
      {replyingTo && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 p-2 bg-[#EEF2FF] rounded-lg border border-[#C5D0E8]">
            <Reply className="h-4 w-4 text-[#001A5E] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#001A5E]">
                {replyingTo.direction === "out" ? (replyingTo.sentByUserName || "Sulma") : "Lead"}
              </p>
              <p className="text-xs text-gray-600 truncate">{replyingTo.body || "Mídia"}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-[#E8EDF8] transition-colors"
              aria-label="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5 text-[#F9A825]" />
            </button>
          </div>
        </div>
      )}

      {/* Edit bar */}
      {editingMessage && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <Pencil className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-blue-600">Editando mensagem</p>
              <p className="text-xs text-gray-600 truncate">{editingMessage.body}</p>
            </div>
            <button
              onClick={() => { setEditingMessage(null); setText(""); }}
              className="p-1 rounded-full hover:bg-blue-100 transition-colors"
              aria-label="Cancelar edição"
            >
              <X className="h-3.5 w-3.5 text-blue-400" />
            </button>
          </div>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
            {attachedPreview ? (
              <img
                src={attachedPreview}
                alt="Preview"
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {attachedFile.name}
              </p>
              <p className="text-xs text-gray-400">
                {(attachedFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              onClick={clearAttachment}
              className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Remover anexo"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Contact picker */}
      {showContactPicker && (
        <div className="px-4 pt-3 pb-1">
          <div className="bg-gray-50 rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Enviar Contato</h4>
              <button
                onClick={() => setShowContactPicker(false)}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                aria-label="Fechar contatos"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar contato..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-[#C5D0E8]"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {savedContacts
                .filter((c) =>
                  !contactSearch ||
                  c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                  c.phone.includes(contactSearch)
                )
                .map((c) => {
                  const hasRealName = /[a-zA-ZÀ-ÿ]/.test(c.name);
                  const displayName = hasRealName ? c.name : c.phone;
                  return (
                    <button
                      key={c.id}
                      onClick={() => sendSavedContact(c)}
                      disabled={sendingContact}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[#EEF2FF] transition-colors text-left disabled:opacity-50"
                    >
                      <Contact className="h-4 w-4 text-[#001A5E] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{displayName}</p>
                        <p className="text-[10px] text-gray-500">
                          {hasRealName ? c.phone : ""}{c.organization ? `${hasRealName ? " · " : ""}${c.organization}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              {savedContacts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">Nenhum contato salvo</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards Gallery */}
      {showCardsGallery && (
        <div className="px-4 pt-3 pb-1">
          <div className="bg-gray-50 rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Cards Informativos</h4>
              <button
                onClick={() => setShowCardsGallery(false)}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                aria-label="Fechar galeria de cards"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {infoCards.length === 0 && (
                <p className="col-span-full text-xs text-gray-400 text-center py-3">
                  Nenhum card cadastrado. Vá em Cards Informativos no menu.
                </p>
              )}
              {infoCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => sendCard(card)}
                  disabled={sendingCard}
                  className="group relative rounded-lg overflow-hidden border hover:border-[#F9A825] transition-all hover:shadow-md disabled:opacity-50"
                >
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="w-full h-16 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-1">
                    <span className="text-white text-[9px] font-medium leading-tight">{card.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emoticons Gallery */}
      {showEmoticonsGallery && (
        <div className="px-4 pt-3 pb-1">
          <div className="bg-gray-50 rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Emoticons Amo Vidas</h4>
              <button
                onClick={() => setShowEmoticonsGallery(false)}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                aria-label="Fechar emoticons"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {availableEmoticons.map((file) => (
                <button
                  key={file}
                  onClick={() => sendEmoticon(file)}
                  disabled={sendingEmoticon}
                  className="rounded-lg overflow-hidden border hover:border-[#F9A825] transition-all hover:shadow-md disabled:opacity-50 bg-white"
                  title={file.replace(/_/g, " ").replace(".png", "")}
                >
                  <img
                    src={`/emoticons/${file}`}
                    alt={file.replace(/_/g, " ").replace(".png", "")}
                    className="w-full h-14 object-contain p-1"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input file oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

      {/* Composer — pill style */}
      <div className="bg-[#f0f2f5] border-t p-3 md:p-4 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 bg-white rounded-full px-4 py-2 shadow-sm">
          {/* Emoji */}
          <div className="relative flex items-center gap-1">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full",
                  showEmojiPicker ? "bg-[#EEF2FF] text-[#001A5E]" : "hover:bg-gray-100 text-gray-500"
                )}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                title="Emojis"
                aria-label="Abrir seletor de emojis"
              >
                <Smile className="h-5 w-5" />
              </Button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            {/* Attach */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendingCard}
              title="Enviar arquivo"
              aria-label="Enviar arquivo"
            >
              <Paperclip className="h-5 w-5 text-gray-500" />
            </Button>
            {/* Contact */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-teal-50"
              onClick={() => { setShowContactPicker((prev) => !prev); if (!showContactPicker) fetchSavedContacts(); }}
              disabled={sendingContact}
              title="Enviar contato"
              aria-label="Enviar contato"
            >
              <Contact className="h-5 w-5 text-teal-500" />
            </Button>
            {/* Cards */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-purple-50"
              onClick={() => setShowCardsGallery((prev) => !prev)}
              disabled={sendingCard}
              title="Cards dos planos"
              aria-label="Cards informativos"
            >
              {sendingCard ? (
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
              ) : (
                <LayoutGrid className="h-5 w-5 text-purple-500" />
              )}
            </Button>
            {/* Emoticons Amo Vidas */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full",
                showEmoticonsGallery ? "bg-[#EEF2FF] text-[#001A5E]" : "hover:bg-[#EEF2FF] text-[#F9A825]"
              )}
              onClick={() => setShowEmoticonsGallery((prev) => !prev)}
              disabled={sendingEmoticon}
              title="Emoticons Amo Vidas"
              aria-label="Emoticons Amo Vidas"
            >
              {sendingEmoticon ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Input */}
          <textarea
            ref={textareaRef}
            placeholder={attachedFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            className="flex-1 border-0 bg-transparent resize-none focus:outline-none focus:ring-0 placeholder:text-gray-400 text-sm py-1.5 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            aria-label="Campo de mensagem"
          />

          {/* Send / Mic */}
          {sendingCard ? (
            <Button
              disabled
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] shadow-md"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </Button>
          ) : text.trim() || attachedFile ? (
            <Button
              onClick={attachedFile ? sendFile : sendText}
              disabled={loading || (!text.trim() && !attachedFile)}
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] hover:from-[#003080] hover:to-[#001040] shadow-md"
              aria-label="Enviar mensagem"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              disabled={loading}
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-[#001A5E] to-[#003080] hover:from-[#003080] hover:to-[#001040] shadow-md"
              title="Gravar áudio"
              aria-label="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
