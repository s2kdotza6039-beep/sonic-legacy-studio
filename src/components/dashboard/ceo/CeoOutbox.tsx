import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Send, Trash2, ExternalLink, Sparkles, Plus, Edit3, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Draft = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  status: string;
  source: string;
  sent_at: string | null;
  sent_via: string | null;
  created_at: string;
};

const empty = { id: "", recipient_email: "", recipient_name: "", subject: "", body: "" };

const CeoOutbox = () => {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState<"draft" | "sent" | "all">("draft");
  const [editing, setEditing] = useState<typeof empty | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDrafts = async () => {
    setLoading(true);
    let q = supabase.from("email_drafts").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setDrafts((data as Draft[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, [filter]);

  // Realtime — new drafts from the AI assistant appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("email_drafts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_drafts" }, () => fetchDrafts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const save = async () => {
    if (!editing) return;
    if (!editing.recipient_email || !editing.subject || !editing.body) {
      toast({ title: "Missing fields", description: "Recipient, subject and body are required.", variant: "destructive" });
      return;
    }
    if (editing.id) {
      const { error } = await supabase.from("email_drafts").update({
        recipient_email: editing.recipient_email,
        recipient_name: editing.recipient_name || null,
        subject: editing.subject,
        body: editing.body,
      }).eq("id", editing.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("email_drafts").insert({
        recipient_email: editing.recipient_email,
        recipient_name: editing.recipient_name || null,
        subject: editing.subject,
        body: editing.body,
        status: "draft",
        source: "manual",
      });
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Draft saved" });
    setEditing(null);
    fetchDrafts();
  };

  const discard = async (id: string) => {
    const { error } = await supabase.from("email_drafts").update({ status: "discarded" }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Draft discarded" });
    fetchDrafts();
  };

  const sendViaSystem = async (d: Draft) => {
    if (!confirm(`Send "${d.subject}" to ${d.recipient_email}?`)) return;
    setSending(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "adhoc-message",
          recipientEmail: d.recipient_email,
          idempotencyKey: `outbox-${d.id}`,
          templateData: {
            subject: d.subject,
            body: d.body,
            recipientName: d.recipient_name || undefined,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await supabase.from("email_drafts").update({
        status: "sent", sent_at: new Date().toISOString(), sent_via: "system",
      }).eq("id", d.id);
      toast({ title: "Email sent", description: `Delivered to ${d.recipient_email}` });
      fetchDrafts();
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const openInMailClient = async (d: Draft) => {
    const mailto = `mailto:${encodeURIComponent(d.recipient_email)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
    window.location.href = mailto;
    await supabase.from("email_drafts").update({
      status: "sent", sent_at: new Date().toISOString(), sent_via: "mailto",
    }).eq("id", d.id);
    setTimeout(fetchDrafts, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Outbox</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border">
            {(["draft", "sent", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs uppercase tracking-wider ${filter === f ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {f}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={fetchDrafts} className="gap-1 text-xs">
            <RefreshCw size={12} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...empty })} className="gap-1 text-xs">
            <Plus size={12} /> New Draft
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Drafts created by the Front Desk Assistant land here. Review, edit, then send via the system or open in your mail client.
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <Mail size={32} className="mx-auto text-muted-foreground opacity-50 mb-2" />
          <p className="text-xs text-muted-foreground">No {filter === "all" ? "" : filter} emails yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(d => (
            <div key={d.id} className="border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{d.subject}</span>
                    {d.source === "ai_assistant" && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                        <Sparkles size={9} /> AI
                      </Badge>
                    )}
                    <Badge variant={d.status === "sent" ? "default" : d.status === "discarded" ? "secondary" : "outline"} className="text-[10px]">
                      {d.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    To: {d.recipient_name ? `${d.recipient_name} <${d.recipient_email}>` : d.recipient_email}
                    {" • "}{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    {d.sent_at && ` • sent via ${d.sent_via}`}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 bg-secondary/20 p-2 border border-border/50">
                {d.body}
              </div>
              {d.status === "draft" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => sendViaSystem(d)} disabled={sending === d.id} className="gap-1 text-xs h-7">
                    <Send size={11} /> {sending === d.id ? "Sending..." : "Send via system"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openInMailClient(d)} className="gap-1 text-xs h-7">
                    <ExternalLink size={11} /> Open in mail client
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({
                    id: d.id,
                    recipient_email: d.recipient_email,
                    recipient_name: d.recipient_name || "",
                    subject: d.subject,
                    body: d.body,
                  })} className="gap-1 text-xs h-7">
                    <Edit3 size={11} /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => discard(d.id)} className="gap-1 text-xs h-7 text-destructive hover:text-destructive">
                    <Trash2 size={11} /> Discard
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit draft" : "New draft"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Recipient email *</Label>
                  <Input value={editing.recipient_email} onChange={e => setEditing({ ...editing, recipient_email: e.target.value })} placeholder="name@example.com" />
                </div>
                <div>
                  <Label className="text-xs">Recipient name</Label>
                  <Input value={editing.recipient_name} onChange={e => setEditing({ ...editing, recipient_name: e.target.value })} placeholder="Jane" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Subject *</Label>
                <Input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Body *</Label>
                <Textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={12} className="font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground mt-1">Plain text. Use blank lines for paragraphs.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CeoOutbox;
