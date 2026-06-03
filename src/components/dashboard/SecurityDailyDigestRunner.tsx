import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Loader2, Send, Mail, History, RefreshCw, ChevronLeft, ChevronRight, Download, X, Bookmark, Save, Trash2 } from "lucide-react";

type ChannelKey = "manual" | "scheduled";
type Preset = {
  name: string;
  statusFilters: StatusKey[];
  channelFilters: ChannelKey[];
  topRuleFilter: string;
  ruleFilter: string;
  dateFrom: string;
  dateTo: string;
  sortKey: SortKey;
};
const PRESETS_KEY = "s2k.digestHistory.presets.v1";

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

type SortKey = "date_desc" | "date_asc" | "status" | "top_rule";
type StatusKey = "ok" | "partial" | "failed" | "unknown";

const topRuleFor = (row: HistoryRow): string => {
  const td = row.metadata?.template_data as { top_meta_rules?: Array<{ rule_name?: string; name?: string }> } | undefined;
  const list = td?.top_meta_rules ?? [];
  const first = list[0];
  return (first?.rule_name ?? first?.name ?? "").toString();
};

const summarizeRow = (row: HistoryRow) => {
  const sent = row.metadata?.sent_results ?? [];
  const recipients = row.metadata?.recipients ?? [];
  const okCount = sent.filter((s) => s.ok).length;
  const total = sent.length || recipients.length;
  const status: StatusKey = total === 0 ? "unknown" : okCount === total ? "ok" : okCount === 0 ? "failed" : "partial";
  return { okCount, total, status };
};

const csvCell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [statusFilters, setStatusFilters] = useState<Set<StatusKey>>(new Set());
  const [channelFilters, setChannelFilters] = useState<Set<ChannelKey>>(new Set());
  const [topRuleFilter, setTopRuleFilter] = useState<string>("");
  const [ruleFilter, setRuleFilter] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(() => {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? "[]"); } catch { return []; }
  });
  const [presetName, setPresetName] = useState("");

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
    const ascending = sortKey === "date_asc";
    const { data, count } = await q
      .order("created_at", { ascending })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
    setHistory((data as HistoryRow[]) ?? []);
    setTotalCount(count ?? 0);
    setHistoryLoading(false);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, sortKey]);

  const applyFilters = () => loadHistory(true);
  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setStatusFilters(new Set()); setChannelFilters(new Set());
    setTopRuleFilter(""); setRuleFilter(""); setPage(0);
    setTimeout(() => loadHistory(true), 0);
  };

  const toggleStatus = (s: StatusKey) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };
  const toggleChannel = (c: ChannelKey) => {
    setChannelFilters((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const channelOf = (r: HistoryRow): ChannelKey => r.action === "daily_report_manual_run" ? "manual" : "scheduled";
  const rulesIn = (r: HistoryRow): string[] => {
    const td = r.metadata?.template_data as { top_meta_rules?: Array<{ rule_name?: string; name?: string }> } | undefined;
    return (td?.top_meta_rules ?? []).map((x) => (x.rule_name ?? x.name ?? "").toString()).filter(Boolean);
  };

  const savePresets = (next: Preset[]) => {
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const saveCurrentAsPreset = () => {
    const name = presetName.trim();
    if (!name) { setResult("Enter a preset name first."); return; }
    const preset: Preset = {
      name,
      statusFilters: Array.from(statusFilters),
      channelFilters: Array.from(channelFilters),
      topRuleFilter, ruleFilter, dateFrom, dateTo, sortKey,
    };
    const next = [...presets.filter((p) => p.name !== name), preset];
    savePresets(next);
    setPresetName("");
    setResult(`Preset “${name}” saved.`);
  };
  const applyPreset = (p: Preset) => {
    setStatusFilters(new Set(p.statusFilters));
    setChannelFilters(new Set(p.channelFilters));
    setTopRuleFilter(p.topRuleFilter);
    setRuleFilter(p.ruleFilter);
    setDateFrom(p.dateFrom);
    setDateTo(p.dateTo);
    setSortKey(p.sortKey);
    setPage(0);
    setTimeout(() => loadHistory(true), 0);
  };
  const deletePreset = (name: string) => savePresets(presets.filter((p) => p.name !== name));


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

  const statusTone = (s: StatusKey) =>
    ({ ok: "text-emerald-600", partial: "text-amber-600", failed: "text-rose-600", unknown: "text-muted-foreground" }[s]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const applyClientFilters = (rows: HistoryRow[]) => {
    let out = rows;
    if (statusFilters.size > 0) out = out.filter((r) => statusFilters.has(summarizeRow(r).status));
    if (channelFilters.size > 0) out = out.filter((r) => channelFilters.has(channelOf(r)));
    if (topRuleFilter) out = out.filter((r) => topRuleFor(r) === topRuleFilter);
    if (ruleFilter) out = out.filter((r) => rulesIn(r).includes(ruleFilter));
    return out;
  };

  const applyClientSort = (rows: HistoryRow[]) => {
    const sorted = [...rows];
    const statusRank: Record<string, number> = { failed: 0, partial: 1, unknown: 2, ok: 3 };
    if (sortKey === "status") {
      sorted.sort((a, b) => statusRank[summarizeRow(a).status] - statusRank[summarizeRow(b).status]);
    } else if (sortKey === "top_rule") {
      sorted.sort((a, b) => topRuleFor(a).localeCompare(topRuleFor(b)) || b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  };

  const visible = useMemo(() => applyClientSort(applyClientFilters(history)), [history, statusFilters, channelFilters, topRuleFilter, ruleFilter, sortKey]);

  const topRuleOptions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((r) => { const t = topRuleFor(r); if (t) set.add(t); });
    return Array.from(set).sort();
  }, [history]);

  const ruleOptions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((r) => rulesIn(r).forEach((n) => set.add(n)));
    return Array.from(set).sort();
  }, [history]);


  const exportCsv = async () => {
    setExporting(true);
    setResult(null);
    try {
      // Fetch up to 5000 rows matching server-side filters (date, action), then apply client filters/sort.
      let q = supabase
        .from("security_audit_log")
        .select("id, created_at, action, metadata")
        .in("action", ["daily_report_manual_run", "daily_report_sent"]);
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      const { data, error } = await q.order("created_at", { ascending: sortKey === "date_asc" }).limit(5000);
      if (error) throw error;
      const filtered = applyClientSort(applyClientFilters((data as HistoryRow[]) ?? []));
      const headers = [
        "id","created_at","kind","status","ok_recipients","total_recipients",
        "top_meta_rule","actor_email","recipients","failed_recipients","template_data_present",
      ];
      const lines = [headers.join(",")];
      filtered.forEach((r) => {
        const s = summarizeRow(r);
        const sent = r.metadata?.sent_results ?? [];
        const failed = sent.filter((x) => !x.ok).map((x) => `${x.to}${x.error ? ":" + x.error : ""}`);
        lines.push([
          r.id, r.created_at,
          r.action === "daily_report_manual_run" ? "manual" : "scheduled",
          s.status, s.okCount, s.total,
          topRuleFor(r), r.metadata?.actor_email ?? "",
          (r.metadata?.recipients ?? []).join("; "),
          failed.join("; "),
          r.metadata?.template_data ? "yes" : "no",
        ].map(csvCell).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url; a.download = `digest-history-${stamp}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setResult(`Exported ${filtered.length} run${filtered.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setResult("Export failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  };

  const activeStatusList: StatusKey[] = ["ok", "partial", "failed", "unknown"];

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
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-7 px-2 text-xs bg-background border border-border rounded"
                title="Sort run history"
              >
                <option value="date_desc">Date ↓ (newest)</option>
                <option value="date_asc">Date ↑ (oldest)</option>
                <option value="status">Status (failed first)</option>
                <option value="top_rule">Top meta-rule (A→Z)</option>
              </select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 w-36 text-xs" />
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 w-36 text-xs" />
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={applyFilters}>Apply</Button>
              {(dateFrom || dateTo || statusFilters.size > 0 || channelFilters.size > 0 || topRuleFilter || ruleFilter) && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clearFilters}>Clear</Button>
              )}
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={exportCsv} disabled={exporting} title="Export current sort + filters to CSV">
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />} CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={historyLoading} className="h-7 px-2">
                {historyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-secondary/10 text-xs">
            <span className="text-muted-foreground">Status:</span>
            {activeStatusList.map((s) => {
              const on = statusFilters.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] capitalize transition ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            <span className="text-muted-foreground ml-2">Top rule:</span>
            <select
              value={topRuleFilter}
              onChange={(e) => setTopRuleFilter(e.target.value)}
              className="h-6 px-2 text-[11px] bg-background border border-border rounded"
              title="Filter by top meta-rule"
            >
              <option value="">All</option>
              {topRuleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {topRuleFilter && (
              <button onClick={() => setTopRuleFilter("")} className="px-1.5 py-0.5 rounded hover:bg-secondary/60 text-muted-foreground" title="Clear top rule filter">
                <X className="w-3 h-3" />
              </button>
            )}
            <div className="flex-1" />
            <span className="text-muted-foreground">{visible.length} of {history.length} on page</span>
          </div>

          {visible.length === 0 && !historyLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {history.length === 0 ? "No digest runs in this range." : "No runs match the current chips."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((row) => {
                const s = summarizeRow(row);
                const isManual = row.action === "daily_report_manual_run";
                const canReplay = !!row.metadata?.template_data;
                const topRule = topRuleFor(row);
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
                    {topRule && (
                      <div className="text-muted-foreground truncate max-w-[180px]" title={`Top meta-rule: ${topRule}`}>
                        · top: <span className="font-mono">{topRule}</span>
                      </div>
                    )}
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
