import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  delivery_message_id: string | null;
  delivery_status: string | null;
  delivery_error: string | null;
  delivery_updated_at: string | null;
};

type DeliveryStatus = {
  status: string;
  error_message: string | null;
  created_at: string;
};

const empty = { id: "", recipient_email: "", recipient_name: "", subject: "", body: "" };

// Honest labels. "sent"/"accepted" means the provider accepted the message —
// it is NOT proof that it reached the recipient's inbox.
const DELIVERY_LABEL: Record<string, string> = {
  pending: "Queued — waiting to be sent",
  queued: "Queued — waiting to be sent",
  accepted: "Accepted by provider — inbox delivery not confirmed",
  sent: "Accepted by provider — inbox delivery not confirmed",
  delivered: "Delivered",
  rate_limited: "Delayed by provider rate limit — will retry",
  failed: "Failed — not sent",
  bounced: "Bounced — the address rejected it",
  complained: "Marked as spam by the recipient",
  suppressed: "Blocked — this address is on the do-not-send list",
  dlq: "Failed after retries — needs attention",
};

const FAILURE_STATES = ["failed", "bounced", "complained", "dlq", "suppressed"];

const deliveryBadgeVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "delivered") return "default";
  if (FAILURE_STATES.includes(s)) return "destructive";
  if (s === "sent" || s === "accepted") return "secondary";
  return "outline";
};

const CeoOutbox = () => {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryStatus>>({});
  const [filter, setFilter] = useState<"draft" | "queued" | "sent" | "all">("draft");
  const [editing, setEditing] = useState<typeof empty | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull the real delivery state from the send log using the SAME correlation
  // ID the send function recorded, and keep the draft row in sync.
  const fetchDeliveries = useCallback(async (list: Draft[]) => {
    const tracked = list.filter(d => d.delivery_message_id);
    if (!tracked.length) { setDeliveries({}); return; }
    const messageIds = tracked.map(d => d.delivery_message_id as string);
    const { data, error } = await supabase
      .from("email_send_log")
      .select("message_id, status, error_message, created_at")
      .in("message_id", messageIds)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load delivery status", description: error.message, variant: "destructive" });
      return;
    }
    const latestByMessage: Record<string, DeliveryStatus> = {};
    (data || []).forEach((row: any) => {
      if (row.message_id && !latestByMessage[row.message_id]) {
        latestByMessage[row.message_id] = {
          status: row.status,
          error_message: row.error_message,
          created_at: row.created_at,
        };
      }
    });

    const map: Record<string, DeliveryStatus> = {};
    for (const d of tracked) {
      const latest = latestByMessage[d.delivery_message_id as string];
      if (!latest) continue;
      map[d.id] = latest;
      if (latest.status !== d.delivery_status) {
        await supabase.from("email_drafts").update({
          delivery_status: latest.status,
          delivery_error: latest.error_message,
          delivery_updated_at: latest.created_at,
          // Only a real provider outcome sets the timestamp on the draft.
          sent_at: latest.status === "delivered" || latest.status === "sent" || latest.status === "accepted"
            ? latest.created_at
            : null,
        }).eq("id", d.id);
      }
    }
    setDeliveries(map);
  }, [toast]);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("email_drafts").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Could not load Outbox", description: error.message, variant: "destructive" });
    }
    const list = (data as Draft[]) || [];
    setDrafts(list);
    setLoading(false);
    fetchDeliveries(list);
  }, [filter, fetchDeliveries, toast]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // Realtime — new drafts from the AI assistant appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("email_drafts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_drafts" }, () => fetchDrafts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDrafts]);

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
    setSending(d.id);
    try {
      // The server reads the stored draft, sends it, records the outcome and
      // updates this draft's delivery fields.
      const { data, error } = await supabase.functions.invoke("send-outbox-email", {
        body: { draftId: d.id },
      });
      if (error) throw error;
      const result = (data as any) || {};
      if (result.error && result.status !== "suppressed") throw new Error(result.error);

      const status: string = result.status || "failed";

      if (status === "suppressed") {
        toast({
          title: "Not sent — address blocked",
          description: `${d.recipient_email} is on the do-not-send list.`,
          variant: "destructive",
        });
        fetchDrafts();
        return;
      }

      if (status !== "accepted") {
        throw new Error(result.error || "The mail service did not accept this message.");
      }

      toast({
        title: "Accepted by the mail service",
        description: "Inbox delivery is not confirmed yet — watch the delivery status on this message.",
      });
      fetchDrafts();
    } catch (e: any) {
      toast({ title: "Send failed — nothing was sent", description: e.message || "Unknown error", variant: "destructive" });
      fetchDrafts();
    } finally {
      setSending(null);
      setConfirmSend(null);
    }
  };

  // Opens the Founder's own mail application. This is NOT a send by this site.
  const openInMailClient = async (d: Draft) => {
    const mailto = `mailto:${encodeURIComponent(d.recipient_email)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
    window.location.href = mailto;
    const { error } = await supabase.from("email_drafts").update({
      status: "mail_client_opened", sent_via: "mailto", sent_at: null,
    }).eq("id", d.id);
    if (error) {
      toast({ title: "Could not update the draft", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mail client opened", description: "Press Send in your mail app — this site did not send it." });
    }
    setTimeout(fetchDrafts, 500);
  };

  const canAct = (s: string) => ["draft", "queued", "blocked", "mail_client_opened"].includes(s);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Outbox</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border">
            {(["draft", "queued", "sent", "all"] as const).map(f => (
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
        Drafts created by the Front Desk Assistant land here. Review, edit, then send via the system or open in your mail
        client. A queued email is not a delivered email — check the delivery status before assuming it arrived.
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
          {drafts.map(d => {
            const live = deliveries[d.id];
            const state = live?.status || d.delivery_status || null;
            const errorText = live?.error_message || d.delivery_error;
            const stamp = live?.created_at || d.delivery_updated_at;
            return (
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
                      <Badge
                        variant={d.status === "discarded" ? "secondary" : d.status === "blocked" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {d.status === "mail_client_opened" ? "mail client opened" : d.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      To: {d.recipient_name ? `${d.recipient_name} <${d.recipient_email}>` : d.recipient_email}
                      {" • "}{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </div>

                    {d.sent_via === "system" && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery:</span>
                        <Badge variant={deliveryBadgeVariant(state || "pending")} className="text-[10px]">
                          {DELIVERY_LABEL[state || "pending"] || state}
                        </Badge>
                        {stamp && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(stamp), { addSuffix: true })}
                          </span>
                        )}
                        {errorText && (
                          <span className="text-[10px] text-destructive truncate max-w-md" title={errorText}>
                            {errorText}
                          </span>
                        )}
                      </div>
                    )}

                    {d.sent_via === "mailto" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery:</span>
                        <Badge variant="secondary" className="text-[10px]">Handled in your mail app</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          (this site did not send it — no tracking)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 bg-secondary/20 p-2 border border-border/50">
                  {d.body}
                </div>
                {canAct(d.status) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" onClick={() => setConfirmSend(d)} disabled={sending === d.id} className="gap-1 text-xs h-7">
                      <Send size={11} />
                      {sending === d.id
                        ? "Queueing..."
                        : state && FAILURE_STATES.includes(state)
                          ? "Retry send"
                          : "Send via system"}
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
            );
          })}
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

      <AlertDialog open={!!confirmSend} onOpenChange={o => !o && setConfirmSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Queue this email for sending?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmSend?.subject}" will be queued for <strong>{confirmSend?.recipient_email}</strong> and sent from your
              verified domain (notify.s2kdotza.com). The delivery status on this message will show the real outcome —
              queueing is not delivery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmSend && sendViaSystem(confirmSend)}>
              <Send size={12} className="mr-1" /> Queue and send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoOutbox;
