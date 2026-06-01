import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, ShieldAlert, Download } from "lucide-react";

type EventSource = "playback" | "payfast" | "ai";

type UnifiedEvent = {
  id: string;
  source: EventSource;
  kind: string;
  at: string;
  actor: string | null;
  target: string | null;
  detail: string;
  raw: Record<string, unknown>;
};

const SOURCE_STYLES: Record<EventSource, string> = {
  playback: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  payfast: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  ai: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const WINDOWS = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
  { key: "all", label: "All", hours: 0 },
] as const;

const SOURCES: Array<{ key: "all" | EventSource; label: string }> = [
  { key: "all", label: "All sources" },
  { key: "playback", label: "Playback blocks" },
  { key: "payfast", label: "PayFast failures" },
  { key: "ai", label: "AI approvals" },
];

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function SecurityEventsPanel() {
  const [rows, setRows] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]["key"]>("7d");
  const [sourceKey, setSourceKey] = useState<"all" | EventSource>("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const w = WINDOWS.find((x) => x.key === windowKey)!;
    const sinceIso = w.hours > 0 ? new Date(Date.now() - w.hours * 3600_000).toISOString() : null;

    const [playback, payfast, ai] = await Promise.all([
      (async () => {
        let q = supabase
          .from("playback_events")
          .select("id, created_at, event_kind, tier, current_seconds, allowed_seconds, track_id, user_id, payment_ref")
          .in("event_kind", ["seek_blocked", "watchdog_clamp", "re_unlock_prompt"])
          .order("created_at", { ascending: false })
          .limit(500);
        if (sinceIso) q = q.gte("created_at", sinceIso);
        const { data } = await q;
        return (data ?? []).map((r): UnifiedEvent => ({
          id: `pb-${r.id}`,
          source: "playback",
          kind: r.event_kind,
          at: r.created_at,
          actor: r.user_id ?? "anon",
          target: r.track_id,
          detail: `${r.tier ?? "—"} · ${Math.round(r.current_seconds ?? 0)}s / ${Math.round(r.allowed_seconds ?? 0)}s`,
          raw: r as unknown as Record<string, unknown>,
        }));
      })(),
      (async () => {
        let q = supabase
          .from("payfast_notify_log")
          .select("id, created_at, outcome, m_payment_id, payment_id, signature_ok, amount_ok, verify_reason, source_ip")
          .in("outcome", ["failed", "invalid", "unknown_payment"])
          .order("created_at", { ascending: false })
          .limit(500);
        if (sinceIso) q = q.gte("created_at", sinceIso);
        const { data } = await q;
        return (data ?? []).map((r): UnifiedEvent => ({
          id: `pf-${r.id}`,
          source: "payfast",
          kind: r.outcome,
          at: r.created_at,
          actor: r.source_ip,
          target: r.m_payment_id ?? r.payment_id,
          detail: `sig=${r.signature_ok ? "ok" : "bad"} amt=${r.amount_ok ? "ok" : "bad"} ${r.verify_reason ?? ""}`.trim(),
          raw: r as unknown as Record<string, unknown>,
        }));
      })(),
      (async () => {
        let q = supabase
          .from("ai_activity_log")
          .select("id, created_at, actor, action, entity_type, entity_id, command, metadata")
          .in("action", ["approved_and_published", "rejected", "deleted_draft"])
          .order("created_at", { ascending: false })
          .limit(500);
        if (sinceIso) q = q.gte("created_at", sinceIso);
        const { data } = await q;
        return (data ?? []).map((r): UnifiedEvent => ({
          id: `ai-${r.id}`,
          source: "ai",
          kind: r.action,
          at: r.created_at,
          actor: r.actor,
          target: `${r.entity_type ?? "—"}${r.entity_id ? "/" + String(r.entity_id).slice(0, 8) : ""}`,
          detail: r.command ?? (r.metadata ? JSON.stringify(r.metadata).slice(0, 140) : ""),
          raw: r as unknown as Record<string, unknown>,
        }));
      })(),
    ]);

    const merged = [...playback, ...payfast, ...ai].sort(
      (a, b) => +new Date(b.at) - +new Date(a.at),
    );
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceKey !== "all" && r.source !== sourceKey) return false;
      if (!q) return true;
      return (
        r.kind.toLowerCase().includes(q) ||
        (r.actor ?? "").toLowerCase().includes(q) ||
        (r.target ?? "").toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q)
      );
    });
  }, [rows, sourceKey, query]);

  const counts = useMemo(() => {
    const c = { all: rows.length, playback: 0, payfast: 0, ai: 0 } as Record<string, number>;
    for (const r of rows) c[r.source]++;
    return c;
  }, [rows]);

  const exportCsv = () => {
    const header = ["at", "source", "kind", "actor", "target", "detail"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([r.at, r.source, r.kind, r.actor, r.target, r.detail].map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> Security Events
          </CardTitle>
          <CardDescription>
            Blocked playback seeks, failed PayFast notifies, and AI approval activity.
          </CardDescription>
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
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className={`px-2.5 py-1 rounded-full border ${windowKey === w.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >{w.label}</button>
          ))}
          <span className="mx-2 text-muted-foreground">|</span>
          {SOURCES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSourceKey(s.key)}
              className={`px-2.5 py-1 rounded-full border ${sourceKey === s.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              {s.label} ({s.key === "all" ? counts.all : counts[s.key] ?? 0})
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Filter by kind, actor, target, or detail…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md"
        />

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Kind</th>
                <th className="text-left p-2">Actor</th>
                <th className="text-left p-2">Target</th>
                <th className="text-left p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No matching events.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full ${SOURCE_STYLES[r.source]}`}>{r.source}</span>
                  </td>
                  <td className="p-2 font-mono">{r.kind}</td>
                  <td className="p-2 font-mono">{r.actor?.slice(0, 18) ?? "—"}</td>
                  <td className="p-2 font-mono">{r.target ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {rows.length} events. Full rules are documented at{" "}
          <a href="/dev/security-rules" className="underline">/dev/security-rules</a>.
        </p>
      </CardContent>
    </Card>
  );
}
