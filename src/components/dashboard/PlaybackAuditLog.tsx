import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Activity } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  event_kind: string;
  tier: string | null;
  current_seconds: number | null;
  allowed_seconds: number | null;
  duration_seconds: number | null;
  payment_ref: string | null;
  user_id: string | null;
  track_id: string | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
};

const KIND_STYLES: Record<string, string> = {
  clamp:              "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  watchdog_clamp:     "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  seek_blocked:       "bg-red-500/15 text-red-600 dark:text-red-400",
  resume:             "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  upgrade_applied:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  tab_resume:         "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  re_unlock_prompt:   "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
};

export default function PlaybackAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const q = supabase.from("playback_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data } = filter === "all" ? await q : await q.eq("event_kind", filter);
    const list = (data ?? []) as Row[];
    setRows(list);

    // Aggregate last-200 stats for the header chips.
    const agg: Record<string, number> = {};
    for (const r of list) agg[r.event_kind] = (agg[r.event_kind] ?? 0) + 1;
    setStats(agg);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const fmt = (n: number | null) =>
    n == null ? "—" : `${Math.floor(n / 60)}:${Math.floor(n % 60).toString().padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Playback Audit Log</CardTitle>
          <CardDescription>
            Every time a preview cap clamps a listener or an upgrade restores entitlements,
            it's recorded here for audit.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-full border ${filter === "all" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            All ({rows.length})
          </button>
          {Object.entries(stats).map(([k, n]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-full ${KIND_STYLES[k] ?? "bg-secondary text-foreground"} ${filter === k ? "ring-2 ring-primary" : ""}`}
            >
              {k} · {n}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Kind</th>
                <th className="text-left p-2">Tier</th>
                <th className="text-left p-2">At / Cap</th>
                <th className="text-left p-2">Track</th>
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No events recorded yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2"><span className={`px-2 py-0.5 rounded-full ${KIND_STYLES[r.event_kind] ?? "bg-secondary"}`}>{r.event_kind}</span></td>
                  <td className="p-2 uppercase">{r.tier ?? "—"}</td>
                  <td className="p-2 tabular-nums">{fmt(r.current_seconds)} / {fmt(r.allowed_seconds)}</td>
                  <td className="p-2 font-mono">{r.track_id?.slice(0, 8) ?? "—"}</td>
                  <td className="p-2 font-mono">{r.user_id?.slice(0, 8) ?? "anon"}</td>
                  <td className="p-2 font-mono">{r.payment_ref ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
