import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Loader2, RefreshCw } from "lucide-react";

// Per-meta-rule trend charts: founders watch attempts, retry rate, and DLQ rate
// trend lines for each delivery_meta rule so they can spot problems BEFORE the
// configured threshold trips an alert. Read-only, founder-RLS gated.

type Rule = {
  id: string;
  name: string;
  event_source: string;
  event_kind: string;
  threshold: number;
  window_minutes: number;
};
type Dispatch = { rule_id: string | null; status: string; attempt: number; created_at: string };
type Dlq = { rule_id: string | null; created_at: string };

const WINDOWS = [
  { key: "24h", label: "24h", hours: 24, buckets: 24, bucketMs: 3600_000 },
  { key: "7d", label: "7d", hours: 24 * 7, buckets: 14, bucketMs: 12 * 3600_000 },
  { key: "30d", label: "30d", hours: 24 * 30, buckets: 30, bucketMs: 24 * 3600_000 },
] as const;

type Series = { t: number; attempts: number; retryRate: number; dlqRate: number };

const buildSeries = (
  windowKey: (typeof WINDOWS)[number]["key"],
  dispatches: Dispatch[],
  dlqs: Dlq[],
): Series[] => {
  const w = WINDOWS.find((x) => x.key === windowKey)!;
  const now = Date.now();
  const start = Math.floor(now / w.bucketMs) * w.bucketMs - (w.buckets - 1) * w.bucketMs;
  const arr: Array<{ t: number; attempts: number; retries: number; dlq: number }> = Array.from(
    { length: w.buckets },
    (_, i) => ({ t: start + i * w.bucketMs, attempts: 0, retries: 0, dlq: 0 }),
  );
  const idx = (ts: number) => Math.floor((ts - start) / w.bucketMs);
  for (const d of dispatches) {
    const i = idx(new Date(d.created_at).getTime());
    if (i < 0 || i >= arr.length) continue;
    arr[i].attempts++;
    arr[i].retries += Math.max(0, (d.attempt ?? 1) - 1);
  }
  for (const q of dlqs) {
    const i = idx(new Date(q.created_at).getTime());
    if (i >= 0 && i < arr.length) arr[i].dlq++;
  }
  return arr.map((b) => ({
    t: b.t,
    attempts: b.attempts,
    retryRate: b.attempts > 0 ? (b.retries / b.attempts) * 100 : 0,
    dlqRate: b.attempts > 0 ? (b.dlq / b.attempts) * 100 : (b.dlq > 0 ? 100 : 0),
  }));
};

// Render a tiny inline SVG polyline for one metric.
function MiniLine({ data, color, max, label }: { data: number[]; color: string; max: number; label: string }) {
  const W = 240, H = 48, P = 2;
  const denom = Math.max(1, max);
  const stepX = (W - P * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${P + i * stepX},${H - P - (v / denom) * (H - P * 2)}`).join(" ");
  const last = data[data.length - 1] ?? 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={W} height={H} className="block">
        <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
      </svg>
      <div className="text-xs">
        <div className="text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="font-mono">{label.endsWith("%") ? last.toFixed(1) + "%" : Math.round(last)}</div>
      </div>
    </div>
  );
}

export default function SecurityMetaRuleCharts() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [dispatch, setDispatch] = useState<Dispatch[]>([]);
  const [dlq, setDlq] = useState<Dlq[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]["key"]>("7d");

  const load = async () => {
    setLoading(true);
    const w = WINDOWS.find((x) => x.key === windowKey)!;
    const sinceIso = new Date(Date.now() - w.hours * 3600_000).toISOString();
    const [r, d, q] = await Promise.all([
      supabase.from("security_alert_rules").select("id,name,event_source,event_kind,threshold,window_minutes").eq("event_source", "delivery_meta"),
      supabase.from("security_alert_dispatch_log").select("rule_id,status,attempt,created_at").gte("created_at", sinceIso).limit(3000),
      supabase.from("security_alert_dlq").select("rule_id,created_at").gte("created_at", sinceIso).limit(1000),
    ]);
    setRules((r.data as Rule[]) ?? []);
    setDispatch((d.data as Dispatch[]) ?? []);
    setDlq((q.data as Dlq[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowKey]);

  const perRule = useMemo(() => {
    return rules.map((rule) => {
      const ds = dispatch.filter((x) => x.rule_id === rule.id);
      const qs = dlq.filter((x) => x.rule_id === rule.id);
      const series = buildSeries(windowKey, ds, qs);
      const maxAttempts = Math.max(1, ...series.map((s) => s.attempts));
      return { rule, series, maxAttempts };
    });
  }, [rules, dispatch, dlq, windowKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><LineChart className="w-5 h-5" /> Meta-rule trends</CardTitle>
          <CardDescription>
            Per delivery-meta rule: attempts, retry rate %, and DLQ rate % over time. Use this to
            spot trends before a threshold is breached.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button key={w.key} onClick={() => setWindowKey(w.key)}
              className={`px-2.5 py-1 text-xs rounded-full border ${windowKey === w.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {w.label}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {perRule.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">
            No delivery_meta rules configured. Add one in “Security Alert Rules”.
          </p>
        )}
        {perRule.map(({ rule, series, maxAttempts }) => (
          <div key={rule.id} className="border border-border rounded-md p-3 bg-secondary/10">
            <div className="flex justify-between items-baseline mb-2">
              <div className="font-medium text-sm">{rule.name}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {rule.event_kind} · threshold {rule.threshold} · window {rule.window_minutes}m
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MiniLine data={series.map((s) => s.attempts)} color="hsl(var(--primary))" max={maxAttempts} label="Attempts" />
              <MiniLine data={series.map((s) => s.retryRate)} color="rgb(245 158 11)" max={100} label="Retry rate %" />
              <MiniLine data={series.map((s) => s.dlqRate)} color="rgb(244 63 94)" max={100} label="DLQ rate %" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
