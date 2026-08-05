import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Maximize2, Mail, GripVertical, Sparkles, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; content: string };
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

const FloatingAssistant = () => {
  const { isFounder } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(() => readPos());
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

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

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 5);
    for (const f of list) {
      if (f.size > 500 * 1024) {
        toast({ title: "File too large", description: `${f.name} exceeds 500KB.`, variant: "destructive" });
        continue;
      }
      try {
        const text = await f.text();
        setAttachments((prev) => [...prev, { name: f.name, content: text }]);
      } catch {
        toast({ title: "Unreadable file", description: `${f.name} could not be read as text.`, variant: "destructive" });
      }
    }
  }, [toast]);

  if (!isFounder) return null;

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const attachBlock = attachments.length
      ? `[ATTACHED FILES — please read and discuss these]:\n` +
        attachments.map((a) => `--- FILE: ${a.name} ---\n${a.content}`).join("\n\n") +
        `\n--- END OF FILES ---\n\n`
      : "";
    const userMsg: Msg = { role: "user", content: `${attachBlock}${input.trim()}` };
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
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
          className={`fixed z-50 w-[380px] h-[500px] border border-border bg-card shadow-2xl flex flex-col rounded-lg overflow-hidden ${pos ? "" : "bottom-6 right-6"}`}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="flex items-center justify-between p-3 border-b border-border bg-secondary/30 cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-muted-foreground" />
              <Bot size={16} className="text-primary" />
              <span className="text-sm font-bold">SYDNEY · Personal Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => closeWindow(true)} className="p-1 hover:text-primary"><Maximize2 size={14} /></button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => closeWindow()} className="p-1 hover:text-primary"><X size={14} /></button>
            </div>
          </div>

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
                      </div>
                    ) : m.content}
                  </div>
                  {m.role === "assistant" && m.content.length > 40 && (
                    <button onClick={() => saveAsDraft(m.content)} className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1">
                      <Mail size={9} /> Save as draft
                    </button>
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
                {attachments.map((a, i) => (
                  <span key={`${a.name}-${i}`} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]">
                    <FileText size={10} className="text-primary" />
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`} className="hover:text-primary">
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
              accept=".txt,.md,.csv,.json,.log,.ts,.tsx,.js,.html,.xml,.yml,.yaml,text/*"
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
