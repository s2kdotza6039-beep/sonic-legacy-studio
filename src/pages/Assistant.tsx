import Layout from "@/components/Layout";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Plus, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Convo = { id: string; title: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/front-desk-assistant`;

const Assistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Convo[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    const { data } = await supabase
      .from("ai_chat_conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  };

  const loadConversation = async (id: string) => {
    setActiveConvo(id);
    const { data } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
  };

  const newConversation = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_chat_conversations")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select()
      .single();
    if (data) {
      setActiveConvo(data.id);
      setMessages([]);
      fetchConversations();
    }
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("ai_chat_conversations").delete().eq("id", id);
    if (activeConvo === id) { setActiveConvo(null); setMessages([]); }
    fetchConversations();
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    if (!activeConvo) {
      await newConversation();
    }

    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    // Save user message
    if (activeConvo) {
      await supabase.from("ai_chat_messages").insert({ conversation_id: activeConvo, role: "user", content: userMsg.content });
      // Update title if first message
      if (messages.length === 0) {
        const title = userMsg.content.slice(0, 50) + (userMsg.content.length > 50 ? "..." : "");
        await supabase.from("ai_chat_conversations").update({ title }).eq("id", activeConvo);
        fetchConversations();
      }
    }

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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, conversation_id: activeConvo }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {}
        }
      }

      // Save assistant message
      if (activeConvo && assistantContent) {
        await supabase.from("ai_chat_messages").insert({ conversation_id: activeConvo, role: "assistant", content: assistantContent });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card p-3 flex flex-col">
          <Button onClick={newConversation} size="sm" className="w-full mb-3 gap-1 text-xs">
            <Plus size={12} /> New Chat
          </Button>
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 cursor-pointer text-xs group ${activeConvo === c.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"}`}
                >
                  <MessageSquare size={12} className="shrink-0 text-muted-foreground" />
                  <span onClick={() => loadConversation(c.id)} className="flex-1 truncate">{c.title}</span>
                  <button onClick={() => deleteConversation(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-border p-4 bg-card">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-primary" />
              <h1 className="text-lg font-display font-bold">Front Desk Assistant</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your AI-powered business assistant for S2K DOT ZA</p>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot size={48} className="text-primary mx-auto mb-4 opacity-50" />
                  <h2 className="text-lg font-display font-bold mb-2">How can I help you today?</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto mt-6">
                    {[
                      "Draft an email to a potential distributor",
                      "Review my upcoming deadlines and subscriptions",
                      "Help me plan a release strategy",
                      "What contracts need attention?",
                    ].map((q, i) => (
                      <button key={i} onClick={() => { setInput(q); }} className="p-3 text-xs text-left border border-border hover:border-primary/50 hover:bg-primary/5 transition">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Bot size={14} className="text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] p-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot size={14} className="text-primary animate-pulse" />
                  </div>
                  <div className="bg-card border border-border p-3 text-sm text-muted-foreground">Thinking...</div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border p-4 bg-card">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask your Front Desk Assistant..."
                className="resize-none min-h-[44px] max-h-[120px] text-sm"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <Button onClick={send} disabled={isLoading || !input.trim()} size="icon" className="shrink-0 h-[44px] w-[44px]">
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Assistant;
