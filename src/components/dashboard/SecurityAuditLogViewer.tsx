import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Download, Loader2, RefreshCw } from "lucide-react";

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

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function SecurityAuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [actor, setActor] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const r = RANGES.find((x) => x.key === rangeKey)!;
    let q = supabase
      .from("security_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (r.hours > 0) q = q.gte("created_at", new Date(Date.now() - r.hours * 3600_000).toISOString());
    const { data } = await q;
    setRows((data as AuditRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rangeKey]);

  const { actions, entities } = useMemo(() => {
    const a = new Set<string>(), e = new Set<string>();
    for (const r of rows) { a.add(r.action); if (r.entity) e.add(r.entity); }
    return { actions: Array.from(a).sort(), entities: Array.from(e).sort() };
  }, [rows]);

  const filtered = useMemo(() => {
    const aq = actor.trim().toLowerCase();
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (entity !== "all" && r.entity !== entity) return false;
      if (aq && !(r.actor_user_id ?? "").toLowerCase().includes(aq)) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        (r.entity ?? "").toLowerCase().includes(q) ||
        (r.ip ?? "").toLowerCase().includes(q) ||
        (r.user_agent ?? "").toLowerCase().includes(q) ||
        JSON.stringify(r.filters ?? {}).toLowerCase().includes(q)
      );
    });
  }, [rows, action, entity, actor, query]);

  const exportCsv = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user?.id) { alert("Sign in as a founder to export."); return; }
    const { error } = await supabase.functions.invoke("log-security-export", {
      body: { entity: "security_audit_log", row_count: filtered.length, filters: { range: rangeKey, action, entity, actor, query } },
    });
    if (error) { alert("Export blocked: " + error.message); return; }
    const header = ["created_at", "actor_user_id", "action", "entity", "row_count", "ip", "user_agent", "filters"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([r.created_at, r.actor_user_id, r.action, r.entity, r.row_count, r.ip, r.user_agent, r.filters].map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Security Audit Log</CardTitle>
          <CardDescription>Every CSV export and admin action is recorded with IP and user agent. Founder-only.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
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
          <Input className="h-8 text-xs" placeholder="Actor user id…" value={actor} onChange={(e) => setActor(e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Search ip / ua / filters…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>
              )}
              {filtered.map((r) => (
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
        <p className="text-xs text-muted-foreground">Showing {filtered.length} of {rows.length} entries.</p>
      </CardContent>
    </Card>
  );
}
