import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Loader2, Send, Mail, History, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type Preview = { subject: string; html: string; templateData: Record<string, unknown> };

type HistoryRow = {
  id: string;
  created_at: string;
  action: string;
  metadata: {
    actor_email?: string | null;
    recipients?: string[];
    sent_results?: Array<{ to: string; ok: boolean; error?: string }>;
    template_data?: Record<string, unknown>;
  } | null;
};

const PAGE_SIZE = 25;

export default function SecurityDailyDigestRunner() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadHistory = async (resetPage = false) => {
    setHistoryLoading(true);
    const p = resetPage ? 0 : page;
    if (resetPage) setPage(0);
    let q = supabase
      .from("security_audit_log")
      .select("id, created_at, action, metadata", { count: "exact" })
      .in("action", ["daily_report_manual_run", "daily_report_sent"]);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    const { data, count } = await q
      .order("created_at", { ascending: false })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
    setHistory((data as HistoryRow[]) ?? []);
    setTotalCount(count ?? 0);
    setHistoryLoading(false);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const applyFilters = () => loadHistory(true);
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setPage(0); setTimeout(() => loadHistory(true), 0); };

  const loadPreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-daily-report", { body: { preview: true } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "preview failed");
      setPreview({ subject: data.subject, html: data.html, templateData: data.templateData });
    } catch (e) {
      setResult("Preview failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewing(false);
    }
  };

  const replayPreview = async (row: HistoryRow) => {
    const td = row.metadata?.template_data;
    if (!td) {
      setResult("This run did not store template data — preview unavailable.");
      return;
    }
    setReplayingId(row.id);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-daily-report", {
        body: { preview: true, template_data: td },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "preview failed");
      setPreview({ subject: data.subject, html: data.html, templateData: data.templateData });
    } catch (e) {
      setResult("Re-open preview failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReplayingId(null);
    }
  };

  const sendNow = async () => {
    if (!confirm("Send the daily security digest to all founders now?")) return;
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("security-daily-report", { body: { manual: true } });
      if (error) throw error;
      const sent = (data?.sent ?? []) as Array<{ to: string; ok: boolean }>;
      const okCount = sent.filter((s) => s.ok).length;
      setResult(`Sent: ${okCount}/${sent.length} recipients.`);
      loadHistory(true);
    } catch (e) {
      setResult("Send failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  };

  const summarize = (row: HistoryRow) => {
    const sent = row.metadata?.sent_results ?? [];
    const recipients = row.metadata?.recipients ?? [];
    const okCount = sent.filter((s) => s.ok).length;
    const total = sent.length || recipients.length;
    const status: "ok" | "partial" | "failed" | "unknown" =
      total === 0 ? "unknown" : okCount === total ? "ok" : okCount === 0 ? "failed" : "partial";
    return { okCount, total, status };
  };

  const statusTone = (s: ReturnType<typeof summarize>["status"]) =>
    ({ ok: "text-emerald-600", partial: "text-amber-600", failed: "text-rose-600", unknown: "text-muted-foreground" }[s]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Daily security digest</CardTitle>
          <CardDescription>
            Preview the digest content and trigger an immediate send. Manual runs are audited as
            <code className="mx-1">daily_report_manual_run</code> in the Security Audit Log.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPreview} disabled={previewing || sending}>
            {previewing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />} Preview
          </Button>
          <Button size="sm" onClick={sendNow} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} Send now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result && <div className="text-xs text-muted-foreground">{result}</div>}
        {preview && (
          <div className="border border-border rounded-md overflow-hidden">
            <div className="bg-secondary/40 px-3 py-2 text-xs font-mono border-b border-border truncate" title={preview.subject}>
              Subject: {preview.subject}
            </div>
            <iframe
              title="digest-preview"
              srcDoc={preview.html}
              className="w-full bg-white"
              style={{ height: 480, border: 0 }}
              sandbox=""
            />
          </div>
        )}
        {!preview && !previewing && (
          <div className="text-xs text-muted-foreground">Click <strong>Preview</strong> to render the digest with the latest 24h metrics.</div>
        )}

        {/* History */}
        <div className="border border-border rounded-md">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2 text-xs font-medium">
              <History className="w-4 h-4" /> Run history
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 w-36 text-xs" />
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 w-36 text-xs" />
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={applyFilters}>Apply</Button>
              {(dateFrom || dateTo) && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clearFilters}>Clear</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={historyLoading} className="h-7 px-2">
                {historyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          {history.length === 0 && !historyLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No digest runs in this range.</div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((row) => {
                const s = summarize(row);
                const isManual = row.action === "daily_report_manual_run";
                const canReplay = !!row.metadata?.template_data;
                return (
                  <div key={row.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <div className="w-40 text-muted-foreground whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${isManual ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {isManual ? "manual" : "scheduled"}
                    </span>
                    <span className={`font-medium ${statusTone(s.status)}`}>{s.status}</span>
                    <div className="text-muted-foreground">
                      {s.okCount}/{s.total} recipient{s.total === 1 ? "" : "s"}
                    </div>
                    {row.metadata?.actor_email && (
                      <div className="text-muted-foreground truncate max-w-[200px]" title={row.metadata.actor_email}>
                        by {row.metadata.actor_email}
                      </div>
                    )}
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={!canReplay || replayingId === row.id}
                      onClick={() => replayPreview(row)}
                      title={canReplay ? "Re-open this run's email preview" : "Template data not stored for this run"}
                    >
                      {replayingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                      Re-open
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-secondary/20 text-xs">
            <div className="text-muted-foreground">
              {totalCount === 0 ? "0 runs" : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}`}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={page === 0 || historyLoading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <div className="text-muted-foreground">Page {page + 1} / {totalPages}</div>
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={page + 1 >= totalPages || historyLoading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
