import { useCallback, useEffect, useRef, useState } from "react";
import { Send, X, GripVertical, Minus, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { AgentConfig, MAX_WORDS, countWords } from "./agentConfig";

type Msg = { role: "user" | "assistant"; content: string };
type Pos = { x: number; y: number };
type Phase = "greeting" | "button" | "chat";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/palesa-front-desk`;
const WIN_W = 380;
const WIN_H = 520;

const clampPos = (p: Pos): Pos => ({
  x: Math.min(Math.max(p.x, 0), Math.max(window.innerWidth - WIN_W, 0)),
  y: Math.min(Math.max(p.y, 0), Math.max(window.innerHeight - WIN_H, 0)),
});

const readPos = (key: string): Pos | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
    return p;
  } catch {
    return null;
  }
};

type Props = {
  agent: AgentConfig;
  /** When true, the greeting bubble opens automatically on first visit. */
  autoGreet: boolean;
};

const AgentBubble = ({ agent, autoGreet }: Props) => {
  const posKey = `${agent.id}_position`;
  const greetKey = `${agent.id}_greeted`;

  const [phase, setPhase] = useState<Phase>("button");
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pos, setPos] = useState<Pos | null>(() => readPos(posKey));
  const scrollRef = useRef<HTMLDivElement>(null);
  const greetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const words = countWords(input);
  const overLimit = words > MAX_WORDS;

  // Greeting bubble auto-appears once per session, per agent.
  useEffect(() => {
    if (!autoGreet) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(greetKey) === "1";
    } catch {}
    if (seen) return;
    const t = setTimeout(() => setPhase((p) => (p === "button" ? "greeting" : p)), 900);
    return () => clearTimeout(t);
  }, [autoGreet, greetKey]);

  // Clicking anywhere outside collapses the greeting into the floating button.
  useEffect(() => {
    if (phase !== "greeting") return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (greetRef.current?.contains(e.target as Node)) return;
      dismissGreeting();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const dismissGreeting = () => {
    try {
      sessionStorage.setItem(greetKey, "1");
    } catch {}
    setPhase("button");
  };

  const savePos = useCallback(
    (p: Pos | null) => {
      if (!p) return;
      try {
        localStorage.setItem(posKey, JSON.stringify(p));
      } catch {}
    },
    [posKey],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.closest("[data-agent-window]")?.getBoundingClientRect();
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

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || isLoading) return;
    if (countWords(text) > MAX_WORDS) return;

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    if (!raw) setInput("");
    setIsLoading(true);

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m,
          );
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
        body: JSON.stringify({ messages: allMessages, agent: agent.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong." }));
        updateAssistant(
          err.error || "Sorry, I couldn't reply just now. Please try again or use /contact.",
        );
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

  const openChatWith = (prompt?: string) => {
    try {
      sessionStorage.setItem(greetKey, "1");
    } catch {}
    setPhase("chat");
    if (prompt) void send(prompt);
  };

  const anchor = agent.side === "left" ? "left-6" : "right-6";

  const nameMark = (
    <span className={`${agent.nameFont} ${agent.nameClass} text-primary`}>{agent.name}</span>
  );

  return (
    <>
      {/* Floating, named button */}
      {phase === "button" && (
        <button
          onClick={() => openChatWith()}
          aria-label={`Open ${agent.name}, ${agent.role}`}
          className={`fixed bottom-6 ${anchor} z-50 group flex items-center gap-3`}
        >
          <span className="relative w-14 h-14 shrink-0">
            <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping" />
            <span
              className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${agent.ringClass} text-primary-foreground shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.7)] transition-transform group-hover:scale-105`}
            >
              <span className={`${agent.nameFont} text-lg font-bold leading-none`}>
                {agent.name[0]}
              </span>
            </span>
          </span>
          <span className="hidden sm:flex flex-col items-start bg-card/90 backdrop-blur border border-border px-3 py-1.5 rounded-full shadow-lg">
            <span className={`${agent.nameFont} ${agent.nameClass} text-xs text-primary`}>
              {agent.name}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              {agent.role}
            </span>
          </span>
        </button>
      )}

      {/* Greeting bubble */}
      {phase === "greeting" && (
        <div
          ref={greetRef}
          className={`fixed bottom-6 ${anchor} z-50 w-[320px] sm:w-[360px] animate-fade-in`}
        >
          <div className="border border-primary/40 bg-card/95 backdrop-blur rounded-lg shadow-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${agent.nameFont} ${agent.nameClass} text-lg text-primary`}>
                    {agent.name}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {agent.role}
                  </p>
                </div>
                <button
                  onClick={dismissGreeting}
                  aria-label={`Minimise ${agent.name}`}
                  className="p-1 text-muted-foreground hover:text-primary"
                >
                  <Minus size={14} />
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{agent.greeting}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => openChatWith(c.prompt)}
                    className="text-[11px] uppercase tracking-widest border border-primary/40 text-primary px-3 py-1.5 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => openChatWith()}
                className="mt-4 w-full text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                Or just start typing →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat window */}
      {phase === "chat" && (
        <div
          data-agent-window
          style={
            !expanded && pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined
          }
          className={
            expanded
              ? "fixed inset-y-0 right-0 z-50 w-full sm:w-[min(640px,100vw)] border-l border-border bg-card shadow-2xl flex flex-col"
              : `fixed z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-2rem)] border border-border bg-card shadow-2xl flex flex-col rounded-lg overflow-hidden ${pos ? "" : `bottom-6 ${anchor}`}`
          }
        >
          <div
            onPointerDown={expanded ? undefined : onPointerDown}
            onPointerMove={expanded ? undefined : onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`flex items-center justify-between p-3 border-b border-border bg-secondary/30 select-none ${expanded ? "" : "cursor-grab active:cursor-grabbing touch-none"}`}
          >
            <div className="flex items-center gap-2">
              {!expanded && <GripVertical size={14} className="text-muted-foreground" />}
              {nameMark}
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                · {agent.role}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Shrink chat" : "Expand chat"}
                className="p-1 hover:text-primary"
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  savePos(pos);
                  setPhase("button");
                }}
                aria-label={`Close ${agent.name}`}
                className="p-1 hover:text-primary"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="bg-secondary border border-border p-3 text-xs space-y-3">
                <p className="text-muted-foreground leading-relaxed">{agent.greeting}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.chips.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => void send(c.prompt)}
                      className="text-[10px] uppercase tracking-widest border border-primary/40 text-primary px-2.5 py-1 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                <div
                  className={`max-w-[85%] p-2 text-xs ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary border border-border"
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

          <div className="border-t border-border p-2 space-y-1">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={agent.placeholder}
                className={`resize-y text-xs ${expanded ? "min-h-[96px] max-h-[320px]" : "min-h-[44px] max-h-[200px]"} ${overLimit ? "border-destructive" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                onClick={() => void send()}
                disabled={isLoading || !input.trim() || overLimit}
                size="icon"
                className="shrink-0 h-9 w-9"
              >
                <Send size={14} />
              </Button>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={overLimit ? "text-destructive" : "text-muted-foreground"}>
                {words} / {MAX_WORDS} words
              </span>
              {overLimit && (
                <span className="text-destructive">Please keep your message under 100 words</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AgentBubble;
