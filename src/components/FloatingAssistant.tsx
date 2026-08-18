import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Maximize2, Minimize2, ExternalLink, Mail, GripVertical, Sparkles, Paperclip, FileText, Volume2, AudioLines, Loader2, Check, AlertTriangle, PanelLeftClose, PanelLeftOpen, Sunrise, ListChecks, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import HtmlPreview from "./HtmlPreview";

type DocFile = { name: string; mime: string; base64: string };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; audio?: string[]; files?: DocFile[] };
type AttachStatus = "uploading" | "parsing" | "ready" | "error";
type Attachment = { id: string; name: string; content: string; kind?: "text" | "image" | "audio" | "file"; dataUrl?: string; mime?: string; base64?: string; status: AttachStatus };

type Pos = { x: number; y: number };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/front-desk-assistant`;
const POS_KEY = "pa_position";
const WIN_W = 380;
const WIN_H = 500;

const clampPos = (p: Pos): Pos => ({
  x: Math.min(Math.max(p.x, 0), Math.max(window.innerWidth - WIN_W, 0)),
  y: Math.min(Math.max(p.y, 0), Math.max(window.innerHeight - WIN_H, 0)),
});

const readPos = (): Pos | null => {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
    return p;
  } catch {
    return null;
  }
};

export const speak = (text: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[*_#>`~|]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
  if (voice) u.voice = voice;
  u.lang = voice?.lang || "en-US";
  synth.speak(u);
};

const FloatingAssistant = () => {
  const { isFounder } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(() => readPos());
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const lastNudgeRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("reminders")
        .select("id,message,due_at")
        .eq("is_done", false)
        .lte("due_at", soon)
        .order("due_at", { ascending: true })
        .limit(1);
      if (cancelled || !data?.length) return;
      const msg = `⏰ Reminder: ${data[0].message}`;
      if (lastNudgeRef.current === msg) return;
      lastNudgeRef.current = msg;
      setNudge(msg);
      setIsOpen(true);
    };
    check();
    const t = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);



  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const savePos = useCallback((p: Pos | null) => {
    if (!p) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(p));
    } catch {}
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.closest("[data-assistant-window]")?.getBoundingClientRect();
      if (!rect) return;
      dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      setPos(clampPos({ x: rect.left, y: rect.top }));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    setPos(clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setPos((p) => {
        savePos(p);
        return p;
      });
    },
    [savePos]
  );

  const closeWindow = useCallback(
    (thenNavigate?: boolean) => {
      savePos(pos);
      setIsOpen(false);
      if (thenNavigate) navigate("/assistant");
    },
    [pos, savePos, navigate]
  );

  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(f);
    });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 5);
    for (const f of list) {
      const name = f.name.toLowerCase();
      const isDoc = /\.(pdf|doc|docx|xls|xlsx|csv)$/.test(name) ||
        /pdf|word|excel|sheet|csv/.test(f.type);
      const kind: NonNullable<Attachment["kind"]> = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("audio/")
          ? "audio"
          : isDoc
            ? "file"
            : "text";
      const limit = kind === "image" ? 5 : kind === "audio" ? 20 : kind === "file" ? 15 : 0.5;
      if (f.size > limit * 1024 * 1024) {
        toast({ title: "File too large", description: `${f.name} exceeds ${limit}MB.`, variant: "destructive" });
        continue;
      }
      const id = `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Chip appears immediately so the Founder sees upload → parse → ready.
      setAttachments((prev) => [...prev, { id, name: f.name, content: "", kind, mime: f.type, status: "uploading" }]);
      const patch = (u: Partial<Attachment>) =>
        setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...u } : a)));
      try {
        if (kind === "image" || kind === "audio") {
          const dataUrl = await readAsDataUrl(f);
          patch({ dataUrl, mime: f.type, status: "ready" });
        } else if (kind === "file") {
          patch({ status: "parsing" });
          const dataUrl = await readAsDataUrl(f);
          const base64 = dataUrl.split(",")[1] ?? "";
          patch({ mime: f.type || "application/octet-stream", base64, status: base64 ? "ready" : "error" });
          if (base64) toast({ title: "Document attached", description: `${f.name} will be read by SYDNEY.` });
        } else {
          patch({ status: "parsing" });
          const text = await f.text();
          patch({ content: text, status: "ready" });
        }
      } catch {
        patch({ status: "error" });
        toast({ title: "Unreadable file", description: `${f.name} could not be read.`, variant: "destructive" });
      }
    }
  }, [toast]);


  if (!isFounder) return null;

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const textAtts = attachments.filter((a) => (a.kind ?? "text") === "text");
    const imageAtts = attachments.filter((a) => a.kind === "image");
    const audioAtts = attachments.filter((a) => a.kind === "audio");
    const fileAtts = attachments.filter((a) => a.kind === "file");
    const attachBlock = textAtts.length
      ? `[ATTACHED FILES — please read and discuss these]:\n` +
        textAtts.map((a) => `--- FILE: ${a.name} ---\n${a.content}`).join("\n\n") +
        `\n--- END OF FILES ---\n\n`
      : "";
    const mediaNote = [
      imageAtts.length ? `${imageAtts.length} image(s)` : null,
      audioAtts.length ? `${audioAtts.length} audio file(s)` : null,
      fileAtts.length ? `${fileAtts.length} document(s): ${fileAtts.map((f) => f.name).join(", ")}` : null,
    ].filter(Boolean).join(", ");
    const noteBlock = mediaNote ? `[ATTACHED MEDIA: ${mediaNote} — please analyse them]\n\n` : "";
    const userMsg: Msg = {
      role: "user",
      content: `${attachBlock}${noteBlock}${input.trim()}`,
      ...(imageAtts.length ? { images: imageAtts.map((a) => a.dataUrl!) } : {}),
      ...(audioAtts.length ? { audio: audioAtts.map((a) => a.dataUrl!) } : {}),
      ...(fileAtts.length ? { files: fileAtts.map((a) => ({ name: a.name, mime: a.mime!, base64: a.base64! })) } : {}),
    };
    const allMessages = [...messages, userMsg];

    setMessages(allMessages);
    setInput("");
    setAttachments([]);
    setIsLoading(true);

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast({ title: "Sign in required", description: "Founder login is required.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) throw new Error("Failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch {}
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const saveAsDraft = async (content: string) => {
    const recipient = window.prompt("Recipient email:");
    if (!recipient) return;
    const subject = window.prompt("Subject:", "");
    if (!subject) return;
    const { error } = await supabase.from("email_drafts").insert({
      recipient_email: recipient.trim(),
      subject: subject.trim(),
      body: content,
      status: "draft",
      source: "ai_assistant",
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else toast({ title: "Draft saved", description: "Open CEO Diary → Outbox to send." });
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open SYDNEY assistant"
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full group"
        >
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <span className="absolute -inset-1 rounded-full border border-primary/40 group-hover:border-primary/70 transition-colors" />
          <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/50 text-primary-foreground shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.7)] transition-transform group-hover:scale-105">
            <Sparkles size={24} />
          </span>
        </button>
      )}


      {/* Chat window */}
      {isOpen && (
        <div
          data-assistant-window
          style={
            expanded
              ? { width: "min(640px, 100vw)" }
              : pos
              ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
              : undefined
          }
          className={`fixed z-50 border border-border bg-card shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            expanded
              ? "top-0 right-0 bottom-0 left-auto h-screen rounded-none"
              : `w-[380px] h-[500px] rounded-lg ${pos ? "" : "bottom-6 right-6"}`
          }`}
        >
          <div
            onPointerDown={expanded ? undefined : onPointerDown}
            onPointerMove={expanded ? undefined : onPointerMove}
            onPointerUp={expanded ? undefined : endDrag}
            onPointerCancel={expanded ? undefined : endDrag}
            className={`flex items-center justify-between p-3 border-b border-border bg-secondary/30 touch-none select-none ${
              expanded ? "" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <div className="flex items-center gap-2">
              {!expanded && <GripVertical size={14} className="text-muted-foreground" />}
              <Bot size={16} className="text-primary" />
              <span className="text-sm font-bold">SYDNEY · Personal Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Shrink assistant" : "Expand assistant"}
                className="p-1 hover:text-primary"
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => closeWindow(true)}
                aria-label="Open full assistant page"
                className="p-1 hover:text-primary"
              >
                <ExternalLink size={14} />
              </button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => closeWindow()} aria-label="Close assistant" className="p-1 hover:text-primary"><X size={14} /></button>
            </div>
          </div>

          {nudge && (
            <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/10 px-3 py-2">
              <Sparkles size={12} className="text-primary shrink-0" />
              <p className="flex-1 text-[11px] leading-snug">{nudge}</p>
              <button onClick={() => setNudge(null)} aria-label="Dismiss reminder" className="text-muted-foreground hover:text-primary">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {messages.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <Bot size={24} className="mx-auto mb-2 opacity-50" />
                <p>How can I help?</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`p-2 text-xs ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
                  }`}>
                    {m.role === "assistant" ? (
                        <div className="prose prose-xs prose-invert max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                          <HtmlPreview content={m.content} />
                        </div>
                      ) : m.content}
                  </div>
                  {m.role === "user" && m.images && m.images.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.images.slice(0, 4).map((src, k) => (
                        <img
                          key={k}
                          src={src}
                          alt={`Attached image ${k + 1} analyzed by SYDNEY`}
                          className="h-16 w-16 rounded object-cover border border-border"
                        />
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && m.content.length > 40 && (
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveAsDraft(m.content)} className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1">
                        <Mail size={9} /> Save as draft
                      </button>
                      <button onClick={() => speak(m.content)} className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1">
                        <Volume2 size={9} /> Listen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="text-xs text-muted-foreground animate-pulse">Thinking...</div>
            )}
            <div ref={scrollRef} />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={`border-t border-border p-2 transition-colors ${isDragOver ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""}`}
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-2">
                {attachments.map((a) => (
                  <span key={a.id} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]">
                    {a.kind === "image" && a.dataUrl ? (
                      <img src={a.dataUrl} alt={`Attached ${a.name}`} className="h-4 w-4 rounded object-cover" />
                    ) : a.kind === "audio" ? (
                      <AudioLines size={10} className="text-primary" />
                    ) : (
                      <FileText size={10} className="text-primary" />
                    )}
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <span className={`flex items-center gap-0.5 uppercase tracking-wider ${a.status === "error" ? "text-destructive" : a.status === "ready" ? "text-primary" : "text-muted-foreground"}`}>
                      {a.status === "uploading" && <><Loader2 size={9} className="animate-spin" /> Uploading</>}
                      {a.status === "parsing" && <><Loader2 size={9} className="animate-spin" /> Reading</>}
                      {a.status === "ready" && <><Check size={9} /> Ready</>}
                      {a.status === "error" && <><AlertTriangle size={9} /> Failed</>}
                    </span>
                    <button onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== a.id))} aria-label={`Remove ${a.name}`} className="hover:text-primary">
                      <X size={10} />
                    </button>
                  </span>
                ))}

              </div>
            )}
            {isDragOver && (
              <p className="pb-2 text-center text-[10px] uppercase tracking-wider text-primary">Drop files to attach</p>
            )}
            <div className="flex gap-2">
            <input
              ref={attachInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.log,.ts,.tsx,.js,.html,.xml,.yml,.yaml,.pdf,.doc,.docx,.xls,.xlsx,text/*,image/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <Button onClick={() => attachInputRef.current?.click()} variant="outline" size="icon" className="shrink-0 h-9 w-9" aria-label="Attach a file">
              <Paperclip size={14} />
            </Button>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="resize-none min-h-[36px] max-h-[80px] text-xs"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <Button onClick={send} disabled={isLoading || (!input.trim() && attachments.length === 0)} size="icon" className="shrink-0 h-9 w-9">
              <Send size={14} />
            </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingAssistant;
