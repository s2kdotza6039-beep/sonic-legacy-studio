import Layout from "@/components/Layout";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Plus, MessageSquare, Trash2, Mail, ArrowLeft, Sparkles, Paperclip, FileText, X, AudioLines, Volume2, Square, Pause, Play, SkipBack, SkipForward, Bug, PanelLeftClose, PanelLeftOpen, Loader2, Check, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import HtmlPreview from "../components/HtmlPreview";
import { useIsMobile } from "@/hooks/use-mobile";

type DocFile = { name: string; mime: string; base64: string };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; audio?: string[]; files?: DocFile[] };
type AttachStatus = "uploading" | "parsing" | "ready" | "error";
type Attachment = { id: string; name: string; kind: "text" | "image" | "audio" | "file"; content: string; mime?: string; base64?: string; status: AttachStatus };
type Convo = { id: string; title: string; created_at: string };

const cleanForSpeech = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_#>`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

let lastSpokenText = "";

const utter = (text: string, rate = 1) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  lastSpokenText = clean;
  const u = new SpeechSynthesisUtterance(clean);
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
  if (voice) u.voice = voice;
  u.lang = voice?.lang || "en-US";
  u.rate = rate;
  synth.speak(u);
};

const speak = (text: string) => utter(text, 1);
const stopSpeech = () => window.speechSynthesis?.cancel();
const pauseSpeech = () => window.speechSynthesis?.pause();
const resumeSpeech = () => window.speechSynthesis?.resume();
// Web Speech API has no native seek: Rewind = restart, Forward = replay faster.
const rewindSpeech = (text?: string) => utter(text || lastSpokenText, 1);
const forwardSpeech = (text?: string) => utter(text || lastSpokenText, 2);



const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?)$/i;
const isDocFile = (f: File) =>
  DOC_EXT.test(f.name) ||
  /pdf|word|excel|sheet|officedocument|ms-?excel|msword/i.test(f.type);

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
  const navigate = useNavigate();
  const [inputRows, setInputRows] = useState(2);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem("assistant_sidebar_open") !== "false"; } catch { return true; }
  });
  const toggleSidebar = () => setSidebarOpen(prev => {
    const next = !prev;
    try { localStorage.setItem("assistant_sidebar_open", String(next)); } catch {}
    return next;
  });

  const readDebugHeader = (resp: Response) => {
    const raw = resp.headers.get("x-attachment-debug");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setDebugInfo(parsed);
      console.info("[SYDNEY attachment debug]", parsed);
    } catch {}
  };

  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(f);
    });

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files).slice(0, 5)) {
      const id = `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const kind: Attachment["kind"] = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("audio/")
          ? "audio"
          : isDocFile(f)
            ? "file"
            : "text";
      const limit = kind === "image" ? 5 : kind === "audio" ? 20 : kind === "file" ? 15 : 0.5;
      if (f.size > limit * 1024 * 1024) {
        toast({ title: "File too large", description: `${f.name} exceeds ${limit}MB.`, variant: "destructive" });
        continue;
      }
      // Show the chip immediately so the Founder sees upload → parse → ready.
      setAttachments((prev) => [...prev, { id, name: f.name, kind, content: "", mime: f.type, status: "uploading" }]);
      const patch = (u: Partial<Attachment>) =>
        setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...u } : a)));
      try {
        if (kind === "image" || kind === "audio") {
          const content = await readAsDataUrl(f);
          patch({ content, mime: f.type, status: "ready" });
        } else if (kind === "file") {
          patch({ status: "parsing" });
          const dataUrl = await readAsDataUrl(f);
          const base64 = dataUrl.split(",")[1] || "";
          if (!base64) {
            patch({ status: "error" });
            toast({ title: "Unreadable document", description: `${f.name} could not be read.`, variant: "destructive" });
            continue;
          }
          patch({ mime: f.type || "application/octet-stream", base64, status: "ready" });
        } else {
          patch({ status: "parsing" });
          const content = await f.text();
          patch({ content, status: "ready" });
        }
      } catch {
        patch({ status: "error" });
        toast({ title: "Unreadable file", description: `${f.name} could not be read.`, variant: "destructive" });
      }
    }
  };



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
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    if (!activeConvo) {
      await newConversation();
    }

    const textFiles = attachments.filter(a => a.kind === "text");
    const imageFiles = attachments.filter(a => a.kind === "image");
    const audioFiles = attachments.filter(a => a.kind === "audio");
    const docFiles = attachments.filter(a => a.kind === "file");

    const attachBlock = textFiles.length
      ? `[ATTACHED FILES — please read and discuss these]:\n` +
        textFiles.map(a => `--- FILE: ${a.name} ---\n${a.content}`).join("\n\n") +
        `\n--- END OF FILES ---\n\n`
      : "";
    const mediaNote = (imageFiles.length || audioFiles.length || docFiles.length)
      ? `[ATTACHED MEDIA]: ${[...imageFiles, ...audioFiles, ...docFiles].map(a => `${a.kind === "file" ? "document" : a.kind}: ${a.name}`).join(", ")}\n\n`
      : "";

    const userMsg: Msg = {
      role: "user",
      content: `${attachBlock}${mediaNote}${input.trim()}`,
      images: imageFiles.length ? imageFiles.map(a => a.content) : undefined,
      audio: audioFiles.length ? audioFiles.map(a => a.content) : undefined,
      files: docFiles.length ? docFiles.map(a => ({ name: a.name, mime: a.mime || "application/octet-stream", base64: a.base64 || "" })) : undefined,
    };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setAttachments([]);
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
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Sign in required");
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: allMessages, conversation_id: activeConvo }),
      });

      readDebugHeader(resp);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (err.attachment_debug) setDebugInfo(err.attachment_debug);
        const warnings = Array.isArray(err.attachment_warnings) && err.attachment_warnings.length
          ? ` (${err.attachment_warnings.join("; ")})`
          : "";
        throw new Error(`${err.error || `Error ${resp.status}`}${warnings}`);
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
      conversation_id: activeConvo,
    });
    if (error) {
      toast({ title: "Failed to save draft", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Draft saved", description: "Open CEO Diary → Outbox to review and send." });
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex relative overflow-hidden">
        {/* Mobile drawer backdrop */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            aria-hidden
            className="absolute inset-0 z-30 bg-background/70 backdrop-blur-sm animate-fade-in"
          />
        )}
        {/* Sidebar */}
        <div
          className={`bg-card flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            isMobile
              ? `absolute inset-y-0 left-0 z-40 w-64 border-r border-border shadow-2xl ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : `shrink-0 ${sidebarOpen ? "w-64 border-r border-border p-3" : "w-0 border-r-0 p-0"}`
          } ${isMobile ? "p-3" : ""}`}
          aria-hidden={!sidebarOpen}
        >
          <Button onClick={newConversation} size="sm" className="w-full mb-3 gap-1 text-xs shrink-0">
            <Plus size={12} /> New Chat
          </Button>
          <ScrollArea className="flex-1">
            <div className="space-y-1 min-w-[13rem]">
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 cursor-pointer text-xs group ${activeConvo === c.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"}`}
                >
                  <MessageSquare size={12} className="shrink-0 text-muted-foreground" />
                  <span onClick={() => { loadConversation(c.id); if (isMobile) setSidebarOpen(false); }} className="flex-1 truncate">{c.title}</span>
                  <button onClick={() => deleteConversation(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>


        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border p-4 bg-card">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleSidebar} aria-label={sidebarOpen ? "Hide chats" : "Show chats"} title={sidebarOpen ? "Hide" : "Chats"} className="gap-1 text-xs">
                {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-1 text-xs">
                <ArrowLeft size={14} /> Back to Workspace
              </Button>
              <Bot size={20} className="text-primary" />
              <h1 className="text-lg font-display font-bold">SYDNEY · Personal Assistant</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your private COO partner for S2KDOTZA — strategy, drafts and daily briefings</p>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
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
                  <div className={`max-w-[80%] flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`p-3 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    }`}>
                      {m.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                            <HtmlPreview content={m.content} />
                          </div>
                      ) : m.content}
                    </div>
                    {m.role === "user" && m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {m.images.slice(0, 4).map((src, k) => (
                          <img key={k} src={src} alt={`Attached image ${k + 1} sent to SYDNEY`} className="h-16 w-16 rounded object-cover border border-border" />
                        ))}
                      </div>
                    )}
                    {m.role === "user" && m.audio && m.audio.length > 0 && (
                      <div className="flex flex-col gap-1 items-end">
                        {m.audio.map((src, k) => (
                          <audio key={k} src={src} controls className="h-8" />
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && m.content.length > 40 && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => saveAsDraft(m.content)}
                          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          <Mail size={10} /> Save as draft
                        </button>
                        <button
                          onClick={() => speak(m.content)}
                          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          <Volume2 size={10} /> Listen
                        </button>
                        <div className="flex items-center gap-2 border-l border-border pl-2">
                          <button onClick={stopSpeech} aria-label="Stop speech" title="Stop" className="text-muted-foreground hover:text-primary">
                            <Square size={11} />
                          </button>
                          <button onClick={pauseSpeech} aria-label="Pause speech" title="Pause" className="text-muted-foreground hover:text-primary">
                            <Pause size={11} />
                          </button>
                          <button onClick={resumeSpeech} aria-label="Resume speech" title="Resume" className="text-muted-foreground hover:text-primary">
                            <Play size={11} />
                          </button>
                          <button onClick={() => rewindSpeech(m.content)} aria-label="Rewind speech" title="Rewind (restart)" className="text-muted-foreground hover:text-primary">
                            <SkipBack size={11} />
                          </button>
                          <button onClick={() => forwardSpeech(m.content)} aria-label="Forward speech" title="Forward (faster)" className="text-muted-foreground hover:text-primary">
                            <SkipForward size={11} />
                          </button>
                        </div>
                      </div>
                    )}

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
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <span key={a.id} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-[10px]">
                      {a.kind === "image" && a.content ? (
                        <img src={a.content} alt={a.name} className="h-6 w-6 rounded object-cover" />
                      ) : a.kind === "audio" ? (
                        <AudioLines size={12} className="text-primary" />
                      ) : (
                        <FileText size={12} className="text-primary" />
                      )}
                      <span className="max-w-[140px] truncate">{a.name}</span>
                      <span
                        className={`flex items-center gap-1 uppercase tracking-wider ${
                          a.status === "error" ? "text-destructive" : a.status === "ready" ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {a.status === "uploading" && <><Loader2 size={10} className="animate-spin" /> Uploading</>}
                        {a.status === "parsing" && <><Loader2 size={10} className="animate-spin" /> Reading</>}
                        {a.status === "ready" && <><Check size={10} /> Ready</>}
                        {a.status === "error" && <><AlertTriangle size={10} /> Failed</>}
                      </span>
                      <button onClick={() => setAttachments(prev => prev.filter(p => p.id !== a.id))} aria-label={`Remove ${a.name}`} className="hover:text-primary">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {debugInfo && (
                <div className="border border-border bg-secondary/30 text-[10px]">
                  <button
                    onClick={() => setShowDebug(v => !v)}
                    className="w-full flex items-center gap-1 px-2 py-1 uppercase tracking-wider text-muted-foreground hover:text-primary"
                  >
                    <Bug size={11} /> Attachment debug ({debugInfo.attachments?.length || 0} detected)
                  </button>
                  {showDebug && (
                    <div className="px-2 pb-2 space-y-1">
                      {(debugInfo.attachments || []).length === 0 && (
                        <p className="text-muted-foreground">No attachments were detected in the last request.</p>
                      )}
                      {(debugInfo.attachments || []).map((a: any, i: number) => (
                        <div key={i} className="flex flex-wrap gap-2 border-b border-border/50 pb-1">
                          <span className="font-mono">{a.detected}</span>
                          <span className="truncate max-w-[180px]">{a.name}</span>
                          <span className="text-muted-foreground">{a.mime}</span>
                          {typeof a.bytes === "number" && <span className="text-muted-foreground">{(a.bytes / 1024).toFixed(0)}KB</span>}
                          {typeof a.text_chars === "number" && <span className="text-muted-foreground">{a.text_chars} chars</span>}
                          <span className={a.status === "ok" ? "text-primary" : "text-destructive"}>{a.status}</span>
                          {a.error && <span className="text-destructive">{a.error}</span>}
                        </div>
                      ))}
                      <p className="text-muted-foreground">
                        Sent to {debugInfo.model}: {(debugInfo.sent_to_gemini || []).map((m: any) => m.parts.join("+")).join(" | ") || "text only"}
                      </p>
                      {(debugInfo.warnings || []).length > 0 && (
                        <p className="text-destructive">Warnings: {debugInfo.warnings.join("; ")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Textarea
                value={input}
                rows={inputRows}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask SYDNEY anything..."
                className="w-full resize-y min-h-[60px] max-h-[320px] text-sm"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={attachInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.csv,.json,.log,.ts,.tsx,.js,.html,.xml,.yml,.yaml,.pdf,.doc,.docx,.xls,.xlsx,text/*,audio/*,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                  />
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => attachInputRef.current?.click()}>
                    <Paperclip size={12} /> Attach
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setInputRows(r => Math.min(8, r + 2))}>
                    <Sparkles size={12} /> Expand
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setInputRows(2)}>
                    Reset
                  </Button>
                </div>
                <Button onClick={send} disabled={isLoading || (!input.trim() && attachments.length === 0)} size="sm" className="gap-1 text-xs">
                  <Send size={14} /> Send
                </Button>

              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Assistant;
