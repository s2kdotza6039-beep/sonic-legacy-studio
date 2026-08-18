import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, X, GripVertical, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Pos = { x: number; y: number };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/palesa-front-desk`;
const POS_KEY = "palesa_position";
const WIN_W = 360;
const WIN_H = 480;

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

const WELCOME =
  "**Eita!** Welcome to **s2kDOTza Entertainment & SONIC-LEGACY-STUDIO**. I am the Front Desk Assistant AI, your guide through this cultural enterprise. This is where township stories meet global platforms — we turn noise into legacy.\n\nSo tell me: who am I talking to today, how can I help you, **Z'khipha Boma What?**\n\n**A)** I am an independent artist looking for development or studio time.\n**B)** I am a brand manager, film producer, or corporate representative seeking partnership.\n**C)** I am a fan, browsing the site.\n**D)** I am a journalist or media outlet looking for Pitch Black Afro or our roster.";


const PalesaAssistant = () => {
  const { isFounder, loading } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pos, setPos] = useState<Pos | null>(() => readPos());
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const savePos = useCallback((p: Pos | null) => {
    if (!p) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(p));
    } catch {}
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.closest("[data-palesa-window]")?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos(clampPos({ x: rect.left, y: rect.top }));
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

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
    [savePos],
  );

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong." }));
        updateAssistant(err.error || "Sorry, I couldn't reply just now. Please try again or use /contact.");
        return;
      }

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
      updateAssistant("Sorry, I'm offline right now. Please reach us via **/contact**.");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return null;
  if (isFounder) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open PALESA front desk assistant"
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full group"
        >
          <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping" />
          <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/50 text-primary-foreground shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.7)] transition-transform group-hover:scale-105">
            <MessageCircleHeart size={22} />
          </span>
        </button>
      )}

      {isOpen && (
        <div
          data-palesa-window
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
          className={`fixed z-50 w-[360px] h-[480px] border border-border bg-card shadow-2xl flex flex-col rounded-lg overflow-hidden ${pos ? "" : "bottom-6 left-6"}`}
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
              <Sparkles size={16} className="text-primary" />
              <span className="text-sm font-bold">PALESA · Front Desk</span>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                savePos(pos);
                setIsOpen(false);
              }}
              aria-label="Close PALESA"
              className="p-1 hover:text-primary"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="bg-secondary border border-border p-2 text-xs">
                <div className="prose prose-xs prose-invert max-w-none">
                  <ReactMarkdown>{WELCOME}</ReactMarkdown>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                <div
                  className={`max-w-[85%] p-2 text-xs ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-xs prose-invert max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="text-xs text-muted-foreground animate-pulse">Thinking...</div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-border p-2 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about our artists, music or shows..."
              className="resize-none min-h-[36px] max-h-[80px] text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={isLoading || !input.trim()} size="icon" className="shrink-0 h-9 w-9">
              <Send size={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default PalesaAssistant;
