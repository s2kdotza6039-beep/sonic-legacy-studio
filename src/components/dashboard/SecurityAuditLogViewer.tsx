import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Loader2, RefreshCw } from "lucide-react";

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity: string | null;
  row_count: number | null;
  filters: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const RANGES = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
  { key: "all", label: "All", hours: 0 },
] as const;

const PAGE_SIZES = [25, 50, 100, 200] as const;
const MAX_EXPORT_ROWS = 5000;

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Build a Supabase query with the current server-side filters applied.
type SBQuery = ReturnType<ReturnType<typeof supabase.from>["select"]>;
const applyFilters = (
  q: SBQuery,
  opts: { sinceIso: string | null; action: string; entity: string; actor: string },
): SBQuery => {
  let out = q;
  if (opts.sinceIso) out = out.gte("created_at", opts.sinceIso);
  if (opts.action !== "all") out = out.eq("action", opts.action);
  if (opts.entity !== "all") out = out.eq("entity", opts.entity);
  if (opts.actor.trim()) out = out.eq("actor_user_id", opts.actor.trim());
  return out;
};

export default function SecurityAuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);

  const sinceIso = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey)!;
    return r.hours > 0 ? new Date(Date.now() - r.hours * 3600_000).toISOString() : null;
  }, [rangeKey]);

  const load = async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
      .from("security_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    q = applyFilters(q, { sinceIso, action, entity, actor });
    const { data, count } = await q;
    setRows((data as AuditRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  // Refresh the distinct action/entity filter options from a small recent sample.
  // We keep this independent of the current filters so the dropdowns don't collapse
  // to a single value after a selection.
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
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rangeKey, action, entity, actor, page, pageSize]);
  // Reset to first page when filters change.
  useEffect(() => { setPage(0); }, [rangeKey, action, entity, actor, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const exportCsv = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user?.id) { alert("Sign in as a founder to export."); return; }
    setExporting(true);

    // Stream rows in pages of 1000 until exhausted or hard cap reached.
    // Keeps memory bounded and exports stay fast even at multi-thousand row scale.
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
        q = applyFilters(q, { sinceIso, action, entity, actor });
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data as AuditRow[]) ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }

      // Server-side audit log entry (founder-only, captures IP + UA).
      const { error: auditError } = await supabase.functions.invoke("log-security-export", {
        body: {
          entity: "security_audit_log",
          row_count: all.length,
          filters: { range: rangeKey, action, entity, actor, max_export_rows: MAX_EXPORT_ROWS },
        },
      });
      if (auditError) { alert("Export blocked: " + auditError.message); return; }

      const header = ["created_at", "actor_user_id", "action", "entity", "row_count", "ip", "user_agent", "filters"];
      const lines = [header.join(",")];
      for (const r of all) {
        lines.push([r.created_at, r.actor_user_id, r.action, r.entity, r.row_count, r.ip, r.user_agent, r.filters].map(csvEscape).join(","));
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
            Server-side filtered & paginated. CSV exports stream up to {MAX_EXPORT_ROWS.toLocaleString()} rows and are themselves audited (IP + user agent).
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded">
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded">
            <option value="all">All entities</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <Input className="h-8 text-xs" placeholder="Actor user id (exact)…" value={actor} onChange={(e) => setActor(e.target.value)} />
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Actor</th>
                <th className="text-left p-2">Action</th>
                <th className="text-left p-2">Entity</th>
                <th className="text-left p-2">Rows</th>
                <th className="text-left p-2">IP</th>
                <th className="text-left p-2">User-Agent</th>
                <th className="text-left p-2">Filters</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono">{r.actor_user_id?.slice(0, 8) ?? "—"}</td>
                  <td className="p-2 font-mono">{r.action}</td>
                  <td className="p-2 font-mono">{r.entity ?? "—"}</td>
                  <td className="p-2">{r.row_count ?? "—"}</td>
                  <td className="p-2 font-mono">{r.ip ?? "—"}</td>
                  <td className="p-2 text-muted-foreground truncate max-w-[200px]" title={r.user_agent ?? ""}>{r.user_agent ?? "—"}</td>
                  <td className="p-2 text-muted-foreground truncate max-w-[260px]" title={JSON.stringify(r.filters ?? {})}>
                    {r.filters ? JSON.stringify(r.filters) : "—"}
                  </td>
                </tr>
              ))}
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
