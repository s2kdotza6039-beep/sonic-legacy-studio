import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2, RefreshCw } from "lucide-react";

type DispatchRow = {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  status: string;
  attempt: number;
  created_at: string;
};

type DlqRow = {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  attempts: number;
  created_at: string;
};

const WINDOWS = [
  { key: "24h", label: "24h", hours: 24, buckets: 24, bucketMs: 3600_000, bucketLabel: (d: Date) => `${d.getHours()}h` },
  { key: "7d", label: "7d", hours: 24 * 7, buckets: 7, bucketMs: 24 * 3600_000, bucketLabel: (d: Date) => d.toLocaleDateString(undefined, { weekday: "short" }) },
  { key: "30d", label: "30d", hours: 24 * 30, buckets: 30, bucketMs: 24 * 3600_000, bucketLabel: (d: Date) => `${d.getDate()}` },
] as const;

export default function SecurityDeliveryMetrics() {
  const [dispatch, setDispatch] = useState<DispatchRow[]>([]);
  const [dlq, setDlq] = useState<DlqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]["key"]>("7d");

  const load = async () => {
    setLoading(true);
    const w = WINDOWS.find((x) => x.key === windowKey)!;
    const sinceIso = new Date(Date.now() - w.hours * 3600_000).toISOString();
    const [d, q] = await Promise.all([
      supabase
        .from("security_alert_dispatch_log")
        .select("id, rule_id, rule_name, status, attempt, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("security_alert_dlq")
        .select("id, rule_id, rule_name, attempts, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setDispatch((d.data as DispatchRow[]) ?? []);
    setDlq((q.data as DlqRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowKey]);

  const summary = useMemo(() => {
    const total = dispatch.length;
    const success = dispatch.filter((r) => r.status === "sent" || r.status === "success").length;
    const failed = dispatch.filter((r) => r.status === "failed").length;
    const retries = dispatch.reduce((acc, r) => acc + Math.max(0, (r.attempt ?? 1) - 1), 0);
    const dlqCount = dlq.length;
    const dlqRate = total > 0 ? dlqCount / total : 0;
    const successRate = total > 0 ? success / total : 0;
    return { total, success, failed, retries, dlqCount, dlqRate, successRate };
  }, [dispatch, dlq]);

  const byRule = useMemo(() => {
    const map = new Map<string, { name: string; total: number; failed: number; retries: number; dlq: number }>();
    for (const r of dispatch) {
      const k = r.rule_id ?? r.rule_name ?? "—";
      const cur = map.get(k) ?? { name: r.rule_name ?? "—", total: 0, failed: 0, retries: 0, dlq: 0 };
      cur.total++;
      if (r.status === "failed") cur.failed++;
      cur.retries += Math.max(0, (r.attempt ?? 1) - 1);
      map.set(k, cur);
    }
    for (const q of dlq) {
      const k = q.rule_id ?? q.rule_name ?? "—";
      const cur = map.get(k) ?? { name: q.rule_name ?? "—", total: 0, failed: 0, retries: 0, dlq: 0 };
      cur.dlq++;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => (b.failed + b.dlq * 2) - (a.failed + a.dlq * 2))
      .slice(0, 12);
  }, [dispatch, dlq]);

  const series = useMemo(() => {
    const w = WINDOWS.find((x) => x.key === windowKey)!;
    const now = Date.now();
    const start = Math.floor(now / w.bucketMs) * w.bucketMs - (w.buckets - 1) * w.bucketMs;
    const buckets = Array.from({ length: w.buckets }, (_, i) => ({
      t: start + i * w.bucketMs,
      label: w.bucketLabel(new Date(start + i * w.bucketMs)),
      attempts: 0,
      failed: 0,
      dlq: 0,
    }));
    const idx = (ts: number) => Math.floor((ts - start) / w.bucketMs);
    for (const r of dispatch) {
      const i = idx(new Date(r.created_at).getTime());
      if (i >= 0 && i < buckets.length) {
        buckets[i].attempts++;
        if (r.status === "failed") buckets[i].failed++;
      }
    }
    for (const q of dlq) {
      const i = idx(new Date(q.created_at).getTime());
      if (i >= 0 && i < buckets.length) buckets[i].dlq++;
    }
    const max = Math.max(1, ...buckets.map((b) => Math.max(b.attempts, b.failed, b.dlq)));
    return { buckets, max };
  }, [dispatch, dlq, windowKey]);

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Alert Delivery Metrics</CardTitle>
          <CardDescription>Attempts, retries, and dead-lettered rates over time. Spot noisy rules or broken destinations.</CardDescription>
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className={`px-2.5 py-1 text-xs rounded-full border ${windowKey === w.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >{w.label}</button>
          ))}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {[
            { k: "Attempts", v: summary.total },
            { k: "Success", v: `${summary.success} (${pct(summary.successRate)})` },
            { k: "Failed", v: summary.failed },
            { k: "Retries", v: summary.retries },
            { k: "DLQ", v: `${summary.dlqCount} (${pct(summary.dlqRate)})` },
          ].map((s) => (
            <div key={s.k} className="p-3 border border-border rounded-md bg-secondary/20">
              <div className="text-muted-foreground uppercase tracking-wider">{s.k}</div>
              <div className="text-lg font-semibold mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Sparkbars */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">Attempts (blue) · Failed (amber) · DLQ (rose)</div>
          <div className="flex items-end gap-1 h-24 border-b border-border">
            {series.buckets.map((b) => (
              <div key={b.t} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${b.label}: attempts=${b.attempts} failed=${b.failed} dlq=${b.dlq}`}>
                <div className="w-full bg-primary/60 rounded-sm" style={{ height: `${(b.attempts / series.max) * 70}%` }} />
                <div className="w-full bg-amber-500/70 rounded-sm" style={{ height: `${(b.failed / series.max) * 70}%` }} />
                <div className="w-full bg-rose-500/70 rounded-sm" style={{ height: `${(b.dlq / series.max) * 70}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            {series.buckets.filter((_, i) => i % Math.max(1, Math.floor(series.buckets.length / 6)) === 0).map((b) => (
              <span key={b.t}>{b.label}</span>
            ))}
          </div>
        </div>

        {/* Per-rule breakdown */}
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">Rule</th>
                <th className="text-left p-2">Attempts</th>
                <th className="text-left p-2">Failed</th>
                <th className="text-left p-2">Retries</th>
                <th className="text-left p-2">DLQ</th>
                <th className="text-left p-2">Fail rate</th>
              </tr>
            </thead>
            <tbody>
              {byRule.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No deliveries in window.</td></tr>
              )}
              {byRule.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.total}</td>
                  <td className="p-2">{r.failed}</td>
                  <td className="p-2">{r.retries}</td>
                  <td className="p-2">{r.dlq}</td>
                  <td className="p-2">{r.total ? pct(r.failed / r.total) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
