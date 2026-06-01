import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, BookmarkPlus, ChevronLeft, ChevronRight, ClipboardList, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";

type DryResult = {
  rule?: string;
  rule_id?: string;
  channel?: string;
  destination?: string;
  would_dispatch?: boolean;
  would_fire?: boolean;
  matched?: number;
  threshold?: number;
  evaluation_hash?: string;
  conditions?: {
    cooldown_active?: boolean;
    cooldown_remaining_min?: number;
    effective_cooldown_min?: number;
    next_allowed_at?: string | null;
    threshold_met?: boolean;
  };
  detail?: {
    total_attempts?: number;
    retries?: number;
    retry_rate_pct?: number;
    dlq_count?: number;
    dlq_rate_pct?: number;
  };
};

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity: string | null;
  row_count: number | null;
  filters: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  metadata: (Record<string, unknown> & { request_id?: string; actor_email?: string; results?: DryResult[] }) | null;
  created_at: string;
};

const RANGES = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
  { key: "all", label: "All", hours: 0 },
] as const;

// Quick action chips.
const ACTION_TABS = [
  { key: "all", label: "All", action: "all" },
  { key: "dryrun", label: "Dry-runs", action: "alert_rule_dryrun" },
  { key: "dispatch", label: "CSV exports", action: "csv_export" },
  { key: "report", label: "Daily reports", action: "daily_report_sent" },
] as const;

const MATCHED_CONDITIONS = [
  { key: "all", label: "All conditions" },
  { key: "would_dispatch", label: "Would dispatch" },
  { key: "cooldown_blocked", label: "Cooldown blocked" },
  { key: "below_threshold", label: "Below threshold" },
] as const;

const PAGE_SIZES = [25, 50, 100, 200] as const;
const MAX_EXPORT_ROWS = 5000;

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const firstDryResult = (row: AuditRow): DryResult | null =>
  (row.metadata?.results?.[0] as DryResult | undefined) ?? null;

type SBQuery = ReturnType<ReturnType<typeof supabase.from>["select"]>;
const applyFilters = (
  q: SBQuery,
  opts: {
    sinceIso: string | null;
    action: string;
    entity: string;
    actor: string;
    destination: string;
    matched: (typeof MATCHED_CONDITIONS)[number]["key"];
    search: string;
  },
): SBQuery => {
  let out = q;
  if (opts.sinceIso) out = out.gte("created_at", opts.sinceIso);
  if (opts.action !== "all") out = out.eq("action", opts.action);
  if (opts.entity !== "all") out = out.eq("entity", opts.entity);
  if (opts.actor.trim()) out = out.eq("actor_user_id", opts.actor.trim());

  // Server-side jsonb filters on dry-run results.
  if (opts.destination.trim()) {
    // Match against either CSV-export destination metadata or dry-run channel destination.
    out = out.or(
      `metadata->results->0->>destination.ilike.%${opts.destination.trim()}%,metadata->>destination.ilike.%${opts.destination.trim()}%`,
    );
  }
  if (opts.matched === "would_dispatch") {
    out = out.eq("metadata->results->0->>would_dispatch", "true");
  } else if (opts.matched === "cooldown_blocked") {
    out = out
      .eq("metadata->results->0->>would_fire", "true")
      .eq("metadata->results->0->conditions->>cooldown_active", "true");
  } else if (opts.matched === "below_threshold") {
    out = out.eq("metadata->results->0->>would_fire", "false");
  }
  if (opts.search.trim()) {
    const s = opts.search.trim();
    out = out.or(
      `metadata->>actor_email.ilike.%${s}%,metadata->>request_id.ilike.%${s}%,user_agent.ilike.%${s}%,ip.ilike.%${s}%`,
    );
  }
  return out;
};

export default function SecurityAuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [actionTab, setActionTab] = useState<(typeof ACTION_TABS)[number]["key"]>("all");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [actor, setActor] = useState("");
  const [destination, setDestination] = useState("");
  const [matched, setMatched] = useState<(typeof MATCHED_CONDITIONS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);

  const sinceIso = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey)!;
    return r.hours > 0 ? new Date(Date.now() - r.hours * 3600_000).toISOString() : null;
  }, [rangeKey]);

  // Action tab overrides the action dropdown.
  const effectiveAction = useMemo(() => {
    const tab = ACTION_TABS.find((t) => t.key === actionTab)!;
    return tab.action === "all" ? action : tab.action;
  }, [actionTab, action]);

  const load = async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
      .from("security_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    q = applyFilters(q, { sinceIso, action: effectiveAction, entity, actor, destination, matched, search });
    const { data, count, error } = await q;
    if (error) console.error("audit query failed", error);
    setRows((data as AuditRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  const refreshFacets = async () => {
    const { data } = await supabase
      .from("security_audit_log")
      .select("action, entity")
      .order("created_at", { ascending: false })
      .limit(500);
    const a = new Set<string>(), e = new Set<string>();
    for (const r of (data ?? []) as Array<{ action: string; entity: string | null }>) {
      a.add(r.action);
      if (r.entity) e.add(r.entity);
    }
    setActions(Array.from(a).sort());
    setEntities(Array.from(e).sort());
  };

  useEffect(() => { refreshFacets(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [rangeKey, effectiveAction, entity, actor, destination, matched, search, page, pageSize]);
  useEffect(() => { setPage(0); },
    [rangeKey, effectiveAction, entity, actor, destination, matched, search, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const exportCsv = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user?.id) { alert("Sign in as a founder to export."); return; }
    setExporting(true);

    const PAGE = 1000;
    const all: AuditRow[] = [];
    try {
      let offset = 0;
      while (offset < MAX_EXPORT_ROWS) {
        let q = supabase
          .from("security_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE - 1);
        q = applyFilters(q, { sinceIso, action: effectiveAction, entity, actor, destination, matched, search });
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data as AuditRow[]) ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }

      const { error: auditError } = await supabase.functions.invoke("log-security-export", {
        body: {
          entity: "security_audit_log",
          row_count: all.length,
          filters: { range: rangeKey, action: effectiveAction, entity, actor, destination, matched, search, max_export_rows: MAX_EXPORT_ROWS },
        },
      });
      if (auditError) { alert("Export blocked: " + auditError.message); return; }

      const header = [
        "created_at", "actor_user_id", "actor_email", "request_id", "action", "entity",
        "row_count", "ip", "user_agent", "filters",
        // Dry-run specific
        "evaluation_hash", "rule_name", "channel", "destination",
        "would_dispatch", "would_fire", "cooldown_active",
        "cooldown_remaining_min", "effective_cooldown_min", "next_allowed_at",
        "matched", "threshold",
        "computed_total_attempts", "computed_retries", "computed_retry_rate_pct",
        "computed_dlq_count", "computed_dlq_rate_pct",
      ];
      const lines = [header.join(",")];
      for (const r of all) {
        const meta = r.metadata ?? {};
        const dr = firstDryResult(r);
        const cond = dr?.conditions ?? {};
        const det = dr?.detail ?? {};
        lines.push([
          r.created_at, r.actor_user_id, meta.actor_email ?? "", meta.request_id ?? "",
          r.action, r.entity, r.row_count, r.ip, r.user_agent, r.filters,
          dr?.evaluation_hash ?? "", dr?.rule ?? "", dr?.channel ?? "", dr?.destination ?? "",
          dr?.would_dispatch ?? "", dr?.would_fire ?? "", cond.cooldown_active ?? "",
          cond.cooldown_remaining_min ?? "", cond.effective_cooldown_min ?? "", cond.next_allowed_at ?? "",
          dr?.matched ?? "", dr?.threshold ?? "",
          det.total_attempts ?? "", det.retries ?? "", det.retry_rate_pct ?? "",
          det.dlq_count ?? "", det.dlq_rate_pct ?? "",
        ].map(csvEscape).join(","));
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Security Audit Log</CardTitle>
          <CardDescription>
            Server-side filtered & paginated. CSV exports stream up to {MAX_EXPORT_ROWS.toLocaleString()} rows,
            include dry-run computed rates, evaluation hash, cooldown state, and are themselves audited.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />} CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refreshFacets(); load(); }} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRangeKey(r.key)}
              className={`px-2.5 py-1 rounded-full border ${rangeKey === r.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {r.label}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground self-center">·</span>
          {ACTION_TABS.map((t) => (
            <button key={t.key} onClick={() => setActionTab(t.key)}
              className={`px-2.5 py-1 rounded-full border ${actionTab === t.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)} disabled={actionTab !== "all"}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded disabled:opacity-50">
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded">
            <option value="all">All entities</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={matched} onChange={(e) => setMatched(e.target.value as (typeof MATCHED_CONDITIONS)[number]["key"])}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded">
            {MATCHED_CONDITIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <Input className="h-8 text-xs" placeholder="Channel destination contains…" value={destination} onChange={(e) => setDestination(e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Search email / IP / UA / request id…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2">
            <Input className="h-8 text-xs flex-1" placeholder="Actor user id (exact)…" value={actor} onChange={(e) => setActor(e.target.value)} />
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
              className="px-2 py-1.5 text-xs bg-background border border-border rounded">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}/pg</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Action</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Request</th>
                <th className="text-left p-2">Rule</th>
                <th className="text-left p-2">Channel · Destination</th>
                <th className="text-left p-2">Result</th>
                <th className="text-left p-2">Hash</th>
                <th className="text-left p-2">IP / UA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>
              )}
              {rows.map((r) => {
                const meta = r.metadata ?? {};
                const dr = firstDryResult(r);
                const cond = dr?.conditions ?? {};
                const isDryrun = r.action === "alert_rule_dryrun";
                const wouldDispatch = dr?.would_dispatch === true;
                const cdActive = cond.cooldown_active === true;
                const wouldFire = dr?.would_fire === true;
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2 font-mono">{r.action}</td>
                    <td className="p-2 truncate max-w-[160px]" title={meta.actor_email ?? ""}>{meta.actor_email ?? "—"}</td>
                    <td className="p-2 font-mono truncate max-w-[110px]" title={meta.request_id ?? ""}>{meta.request_id?.slice(0, 8) ?? "—"}</td>
                    <td className="p-2">{dr?.rule ?? "—"}</td>
                    <td className="p-2 font-mono truncate max-w-[220px]" title={`${dr?.channel ?? ""}: ${dr?.destination ?? ""}`}>
                      {dr ? `${dr.channel}: ${dr.destination?.slice(0, 36) ?? ""}` : "—"}
                    </td>
                    <td className="p-2">
                      {isDryrun ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${wouldDispatch ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : cdActive && wouldFire ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>
                            {wouldDispatch ? "would dispatch" : cdActive && wouldFire ? "cooldown blocked" : "below threshold"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            matched {dr?.matched ?? 0}/{dr?.threshold ?? 0}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{r.row_count ?? "—"} row(s)</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-[10px]" title={dr?.evaluation_hash ?? ""}>
                      {dr?.evaluation_hash?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="p-2 text-muted-foreground truncate max-w-[200px]" title={`${r.ip ?? ""}\n${r.user_agent ?? ""}`}>
                      <div className="font-mono">{r.ip ?? "—"}</div>
                      <div className="text-[10px] truncate">{r.user_agent ?? ""}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {total === 0 ? "0 entries" : `Page ${page + 1} of ${pageCount} · ${total.toLocaleString()} total`}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={loading || page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={loading || page >= pageCount - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
