import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ClickRow {
  id: string;
  release_id: string | null;
  release_title: string | null;
  artist_name: string | null;
  destination_url: string;
  source: string;
  created_at: string;
  referrer: string | null;
}

interface Aggregate {
  key: string;
  title: string;
  artist: string;
  total: number;
  last: string;
  destination: string;
  bySource: Record<string, number>;
}

const WINDOWS = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7d", hours: 24 * 7 },
  { key: "30d", label: "30d", hours: 24 * 30 },
  { key: "all", label: "All", hours: 0 },
] as const;

export default function ReleaseClicksPanel() {
  const [rows, setRows] = useState<ClickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<(typeof WINDOWS)[number]["key"]>("7d");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("release_clicks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!error) setRows((data || []) as ClickRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const win = WINDOWS.find((w) => w.key === window)!;
    if (win.hours === 0) return rows;
    const cutoff = Date.now() - win.hours * 3600 * 1000;
    return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [rows, window]);

  const aggregates: Aggregate[] = useMemo(() => {
    const map = new Map<string, Aggregate>();
    for (const r of filtered) {
      const key = r.release_id || `${r.artist_name}—${r.release_title}` || r.destination_url;
      const existing = map.get(key);
      if (existing) {
        existing.total += 1;
        existing.bySource[r.source] = (existing.bySource[r.source] || 0) + 1;
        if (new Date(r.created_at) > new Date(existing.last)) existing.last = r.created_at;
      } else {
        map.set(key, {
          key,
          title: r.release_title || "(untitled)",
          artist: r.artist_name || "—",
          total: 1,
          last: r.created_at,
          destination: r.destination_url,
          bySource: { [r.source]: 1 },
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalClicks = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Cloud size={18} className="text-primary" /> Cloudflare Cloud Clicks
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Outbound traffic from the "Get on Cloudflare Cloud" button.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => setWindow(w.key)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                  window === w.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total clicks" value={totalClicks} />
        <Stat label="Unique releases" value={aggregates.length} />
        <Stat
          label="Top single"
          value={aggregates[0]?.title?.slice(0, 18) || "—"}
          sub={aggregates[0] ? `${aggregates[0].total} clicks` : undefined}
        />
        <Stat
          label="Top source"
          value={topSource(filtered) || "—"}
        />
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          By release
        </h3>
        {aggregates.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border p-6 text-center">
            No clicks recorded in this window yet.
          </p>
        ) : (
          <div className="border border-border divide-y divide-border">
            {aggregates.map((a) => (
              <div key={a.key} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.artist} · last {formatDistanceToNow(new Date(a.last), { addSuffix: true })}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(a.bySource).map(([s, n]) => (
                      <span
                        key={s}
                        className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5"
                      >
                        {s} · {n}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href={a.destination}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                  title="Open Cloud URL"
                >
                  <ExternalLink size={14} />
                </a>
                <div className="text-right">
                  <p className="text-2xl font-display font-bold text-primary leading-none">{a.total}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">clicks</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Recent clicks</h3>
        <div className="border border-border divide-y divide-border max-h-80 overflow-y-auto">
          {filtered.slice(0, 50).map((r) => (
            <div key={r.id} className="p-2 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </span>
              <span className="flex-1 truncate">
                <span className="font-semibold">{r.release_title || "(untitled)"}</span>
                <span className="text-muted-foreground"> · {r.artist_name || "—"}</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                {r.source}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center">No data.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-border p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-display font-bold text-primary mt-1 truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function topSource(rows: ClickRow[]): string | null {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.source] = (counts[r.source] || 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || null;
}
