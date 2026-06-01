import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Timer, ChevronDown, ChevronRight, Download } from "lucide-react";

type DryrunRow = {
  id: string;
  created_at: string;
  metadata: {
    results?: Array<{
      rule?: string;
      rule_id?: string;
      channel?: string;
      destination?: string;
      would_dispatch?: boolean;
      would_fire?: boolean;
      matched?: number;
      threshold?: number;
      conditions?: { cooldown_active?: boolean; cooldown_remaining_min?: number; next_allowed_at?: string | null };
    }>;
  } | null;
};

type DispatchRow = {
  id: string;
  created_at: string;
  rule_id: string | null;
  rule_name: string | null;
  channel: string | null;
  destination: string | null;
  matched_count: number | null;
  status: string;
  attempt?: number;
};

type Item = {
  ts: string;
  kind: "dryrun" | "dispatch";
  label: string;
  outcome: string;
  outcomeTone: "rose" | "amber" | "emerald" | "muted";
  detail: string;
  matched?: number;
  threshold?: number;
  cooldownActive?: boolean;
  cooldownRemainingMin?: number;
  nextAllowedAt?: string | null;
  attempt?: number;
};

type GroupKey = string;
type Group = { rule: string; channel: string; destination: string; items: Item[] };

const RANGES = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
] as const;

const toneClass = (t: Item["outcomeTone"]) => ({
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
}[t]);

export default function SecurityAuditTimeline() {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("24h");
  const [loading, setLoading] = useState(true);
  const [dryruns, setDryruns] = useState<DryrunRow[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [expanded, setExpanded] = useState<Set<GroupKey>>(new Set());
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const sinceIso = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey)!;
    return new Date(Date.now() - r.hours * 3600_000).toISOString();
  }, [rangeKey]);

  const load = async () => {
    setLoading(true);
    const [dr, ds] = await Promise.all([
      supabase.from("security_audit_log").select("id, created_at, metadata").eq("action", "alert_rule_dryrun").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(500),
      supabase.from("security_alert_dispatch_log").select("id, created_at, rule_id, rule_name, channel, destination, matched_count, status, attempt").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(500),
    ]);
    setDryruns((dr.data as DryrunRow[]) ?? []);
    setDispatches((ds.data as DispatchRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rangeKey]);

  const groups = useMemo((): Group[] => {
    const map = new Map<GroupKey, Group>();
    const upsert = (rule: string, channel: string, destination: string, item: Item) => {
      const key = `${rule}|${channel}|${destination}`;
      const g = map.get(key) ?? { rule, channel, destination, items: [] };
      g.items.push(item);
      map.set(key, g);
    };

    for (const r of dryruns) {
      const dr = r.metadata?.results?.[0];
      if (!dr) continue;
      const cdActive = dr.conditions?.cooldown_active === true;
      const tone: Item["outcomeTone"] = dr.would_dispatch ? "rose" : cdActive && dr.would_fire ? "amber" : "emerald";
      const outcome = dr.would_dispatch ? "would dispatch" : cdActive && dr.would_fire ? "cooldown blocked" : "below threshold";
      const next = dr.conditions?.next_allowed_at;
      upsert(dr.rule ?? "(rule)", dr.channel ?? "?", dr.destination ?? "?", {
        ts: r.created_at,
        kind: "dryrun",
        label: "Dry-run",
        outcome,
        outcomeTone: tone,
        detail: `matched ${dr.matched ?? 0}/${dr.threshold ?? 0}${cdActive ? ` · cooldown ${dr.conditions?.cooldown_remaining_min ?? 0}m left${next ? ` · next ${new Date(next).toLocaleTimeString()}` : ""}` : ""}`,
        matched: dr.matched,
        threshold: dr.threshold,
        cooldownActive: cdActive,
        cooldownRemainingMin: dr.conditions?.cooldown_remaining_min,
        nextAllowedAt: next ?? null,
      });
    }
    for (const d of dispatches) {
      const tone: Item["outcomeTone"] = d.status === "sent" ? "rose" : d.status === "skipped_cooldown" ? "amber" : d.status === "failed" || d.status === "dlq" ? "muted" : "emerald";
      upsert(d.rule_name ?? "(rule)", d.channel ?? "?", d.destination ?? "?", {
        ts: d.created_at,
        kind: "dispatch",
        label: `Dispatch · attempt ${d.attempt ?? 1}`,
        outcome: d.status,
        outcomeTone: tone,
        detail: `matched ${d.matched_count ?? 0}`,
        matched: d.matched_count ?? undefined,
        attempt: d.attempt,
      });
    }

    const arr = Array.from(map.values());
    for (const g of arr) g.items.sort((a, b) => b.ts.localeCompare(a.ts));
    arr.sort((a, b) => b.items.length - a.items.length);
    return arr;
  }, [dryruns, dispatches]);

  const toggle = (k: GroupKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "rule", "channel", "destination", "event_kind", "timestamp", "outcome",
      "matched", "threshold", "attempt", "cooldown_active", "cooldown_remaining_min", "next_allowed_at",
    ];
    const lines = [header.join(",")];
    for (const g of groups) {
      // Items are already sorted newest-first per group. Export oldest-first so
      // cooldown transitions read chronologically.
      const ordered = [...g.items].sort((a, b) => a.ts.localeCompare(b.ts));
      for (const it of ordered) {
        lines.push([
          g.rule, g.channel, g.destination, it.kind, it.ts, it.outcome,
          it.matched ?? "", it.threshold ?? "", it.attempt ?? "",
          it.cooldownActive ?? "", it.cooldownRemainingMin ?? "", it.nextAllowedAt ?? "",
        ].map(esc).join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-timeline-${rangeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Timer className="w-5 h-5" /> Delivery timeline</CardTitle>
          <CardDescription>
            Dry-run and real dispatch attempts grouped by <code>rule · channel · destination</code>.
            Cooldown transitions and outcomes appear in chronological order.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-wrap gap-1 text-xs">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRangeKey(r.key)}
                className={`px-2.5 py-1 rounded-full border ${rangeKey === r.key ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || groups.length === 0}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length === 0 && !loading && (
          <div className="text-center text-xs text-muted-foreground py-6">No activity in the selected window.</div>
        )}
        {groups.map((g) => {
          const key = `${g.rule}|${g.channel}|${g.destination}`;
          const open = expanded.has(key);
          return (
            <div key={key} className="border border-border rounded-md">
              <button onClick={() => toggle(key)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-secondary/30">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{g.rule}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {g.channel}: {g.destination}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{g.items.length} event(s)</div>
              </button>
              {open && (
                <div className="border-t border-border divide-y divide-border">
                  {g.items.map((it, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 text-xs">
                      <div className="w-32 text-muted-foreground whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                      <div className="w-32 font-mono">{it.label}</div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${toneClass(it.outcomeTone)}`}>
                        {it.outcome}
                      </span>
                      <div className="flex-1 text-muted-foreground">{it.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
