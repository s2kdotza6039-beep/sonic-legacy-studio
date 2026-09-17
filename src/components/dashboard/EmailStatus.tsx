import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Mail, AlertTriangle } from "lucide-react";

type Draft = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  delivery_message_id: string | null;
  delivery_status: string | null;
  delivery_error: string | null;
  delivery_updated_at: string | null;
};

type LogRow = {
  message_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

const LABEL: Record<string, string> = {
  draft: "Draft — not queued",
  queued: "Queued — waiting to be sent",
  pending: "Queued — waiting to be sent",
  accepted: "Accepted by provider — inbox delivery not confirmed",
  sent: "Accepted by provider — inbox delivery not confirmed",
  delivered: "Delivered (provider confirmed)",
  rate_limited: "Held back — provider rate limit",
  suppressed: "Blocked — address is suppressed",
  blocked: "Blocked — not sent",
  failed: "Failed",
  bounced: "Bounced",
  complained: "Complaint received",
  dlq: "Dead-lettered — needs attention",
  mail_client_opened: "Opened in your mail app — send it there",
  discarded: "Discarded",
};

const TONE = (s: string) =>
  ["delivered"].includes(s) ? "text-emerald-400"
  : ["accepted", "sent"].includes(s) ? "text-primary"
  : ["queued", "pending", "rate_limited", "mail_client_opened", "draft"].includes(s) ? "text-yellow-400"
  : ["failed", "bounced", "complained", "dlq", "suppressed", "blocked"].includes(s) ? "text-destructive"
  : "text-muted-foreground";

const EmailStatus = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [logs, setLogs] = useState<Record<string, LogRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: dErr } = await supabase
      .from("email_drafts")
      .select("id, recipient_email, recipient_name, subject, status, sent_at, created_at, delivery_message_id, delivery_status, delivery_error, delivery_updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (dErr) {
      setError(dErr.message);
      setLoading(false);
      return;
    }
    setDrafts((data ?? []) as Draft[]);

    const ids = (data ?? []).map((d) => d.delivery_message_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: logRows, error: lErr } = await supabase
        .from("email_send_log")
        .select("message_id, status, error_message, created_at")
        .in("message_id", ids)
        .order("created_at", { ascending: false });
      if (lErr) setError(lErr.message);
      const latest: Record<string, LogRow> = {};
      for (const r of logRows ?? []) {
        if (r.message_id && !latest[r.message_id]) latest[r.message_id] = r as LogRow;
      }
      setLogs(latest);
    } else {
      setLogs({});
    }
    setRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-primary" />
          <h2 className="text-xl font-display font-bold">Email Status</h2>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Checked {refreshedAt.toLocaleTimeString()}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="text-xs gap-1">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Real state of every Outbox message. "Accepted by provider" means the mail service took it — it is not proof it
        landed in the inbox.
      </p>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Could not load email status: {error}
        </div>
      )}

      <div className="space-y-2">
        {drafts.map((d) => {
          const log = d.delivery_message_id ? logs[d.delivery_message_id] : undefined;
          const status = log?.status || d.delivery_status || d.status;
          const failure = log?.error_message || d.delivery_error;
          const stamp = log?.created_at || d.delivery_updated_at || d.sent_at || d.created_at;
          return (
            <Card key={d.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.recipient_name ? `${d.recipient_name} · ` : ""}{d.recipient_email}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest ${TONE(status)}`}>
                    {LABEL[status] || status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                  <span>Message ID: {d.delivery_message_id || "— not queued yet"}</span>
                  <span>Last update: {stamp ? new Date(stamp).toLocaleString() : "—"}</span>
                  <span>Provider result: {log ? log.status : "no provider record yet"}</span>
                </div>
                {failure && <p className="text-[11px] text-destructive">Reason: {failure}</p>}
              </CardContent>
            </Card>
          );
        })}
        {!loading && drafts.length === 0 && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">No emails in the Outbox yet.</p>
        )}
      </div>
    </div>
  );
};

export default EmailStatus;
