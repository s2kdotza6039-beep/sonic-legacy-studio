import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, RefreshCw, FlaskConical } from "lucide-react";

type Tier = "free" | "standard" | "gold" | "cristal";
type Track = { id: string; title: string; artist_name: string | null; r2_object_key: string };
type PlaybackEvent = {
  id: string;
  event_kind: string;
  tier: string | null;
  track_id: string | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
};

const TIERS: Tier[] = ["free", "standard", "gold", "cristal"];
const WORKER_KINDS = new Set([
  "worker_granted",
  "worker_denied_signature",
  "worker_denied_expired",
  "worker_denied_path",
  "worker_denied_range",
  "worker_denied_replay",
  "worker_denied_rate_limit",
]);

function decodePayload(token: string): unknown {
  try {
    const [p] = token.split(".");
    if (!p) return null;
    let s = p.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(atob(s));
  } catch {
    return null;
  }
}

function normalize(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function canonical(raw: string): string {
  const d = normalize(raw);
  return d.replace(/\s+/g, " ").replace(/\s+(\.\w+)?$/g, "$1").trim();
}

function hasTrailingSpace(raw: string): boolean {
  const d = normalize(raw);
  return /\s\.[A-Za-z0-9]+$/.test(d) || /\s$/.test(d);
}

type CheckOutcome = "pending" | "running" | "pass" | "fail";
type Check = {
  id: "expired" | "bad_sig" | "path_mismatch" | "replay";
  label: string;
  expectStatus: number;
  expectKind: string;
  outcome: CheckOutcome;
  detail?: string;
};

const WorkerPlaybackTest = () => {
  const { toast } = useToast();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState<string>("");
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [mintMeta, setMintMeta] = useState<{ granted?: string; pct?: number; expires_in?: number } | null>(null);
  const [headResult, setHeadResult] = useState<string | null>(null);
  const [events, setEvents] = useState<PlaybackEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checks, setChecks] = useState<Check[]>([
    { id: "expired", label: "Expired token rejected", expectStatus: 401, expectKind: "worker_denied_expired", outcome: "pending" },
    { id: "bad_sig", label: "Tampered signature rejected", expectStatus: 401, expectKind: "worker_denied_signature", outcome: "pending" },
    { id: "path_mismatch", label: "Path mismatch rejected", expectStatus: 403, expectKind: "worker_denied_path", outcome: "pending" },
    { id: "replay", label: "Signed URL reuse blocked", expectStatus: 401, expectKind: "worker_denied_replay", outcome: "pending" },
  ]);
  const [runningChecks, setRunningChecks] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,artist_name,r2_object_key")
        .eq("is_active", true)
        .order("title");
      setTracks(data ?? []);
      if (data && data[0]) setTrackId(data[0].id);
    })();
  }, []);

  const selectedTrack = useMemo(() => tracks.find((t) => t.id === trackId), [tracks, trackId]);
  const decodedKey = selectedTrack ? normalize(selectedTrack.r2_object_key) : "";
  const tokenPayload = signedUrl
    ? decodePayload(new URL(signedUrl).searchParams.get("t") ?? "")
    : null;

  const loadEvents = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from("playback_events")
      .select("id,event_kind,tier,track_id,metadata,user_agent,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as PlaybackEvent[]);
    setRefreshing(false);
  };

  useEffect(() => { loadEvents(); }, []);

  const mintUrl = async () => {
    if (!trackId) return;
    setLoading(true);
    setSignedUrl(null);
    setHeadResult(null);
    setMintMeta(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-track`);
      url.searchParams.set("track_id", trackId);
      url.searchParams.set("tier", tier);
      url.searchParams.set("json", "1");
      const r = await fetch(url.toString(), {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setSignedUrl(body.url);
      setMintMeta({ granted: body.granted, pct: body.pct, expires_in: body.expires_in });
      toast({ title: "Signed URL minted", description: `tier=${body.granted} pct=${body.pct}` });
    } catch (e) {
      toast({ title: "Mint failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const probeWorker = async () => {
    if (!signedUrl) return;
    setHeadResult("…probing");
    try {
      const r = await fetch(signedUrl, { method: "GET", headers: { Range: "bytes=0-1" } });
      const txt = r.status >= 400 ? await r.text() : `OK (${r.headers.get("Content-Length") ?? "?"} bytes, range ${r.headers.get("Content-Range") ?? "n/a"})`;
      setHeadResult(`${r.status} ${r.statusText} — ${txt}`);
      setTimeout(loadEvents, 800);
    } catch (e) {
      setHeadResult(`network error: ${(e as Error).message}`);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
          <FlaskConical size={16} className="text-primary" /> Worker Playback Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Track</label>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="w-full mt-1 bg-background border border-border px-3 py-2 text-sm"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.title} — {t.artist_name ?? "—"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="w-full mt-1 bg-background border border-border px-3 py-2 text-sm"
            >
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={mintUrl} disabled={loading || !trackId} className="flex-1">
              {loading ? <Loader2 className="animate-spin" size={14} /> : <PlayCircle size={14} />} Mint signed URL
            </Button>
          </div>
        </div>

        {selectedTrack && (
          <div className="text-xs space-y-1 border border-border p-3 bg-secondary/30">
            <div><span className="text-muted-foreground">Stored key:</span> <code>{selectedTrack.r2_object_key}</code></div>
            <div><span className="text-muted-foreground">Decoded (worker compares):</span> <code>{decodedKey}</code></div>
            {selectedTrack.r2_object_key !== decodedKey && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/50">percent-encoded — normalized before sign</Badge>
            )}
          </div>
        )}

        {signedUrl && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Signed URL</div>
            <textarea readOnly value={signedUrl} rows={3} className="w-full bg-background border border-border p-2 text-xs font-mono" />
            <div className="text-xs space-y-1">
              <div><span className="text-muted-foreground">Granted:</span> {mintMeta?.granted} · pct={mintMeta?.pct} · ttl={mintMeta?.expires_in}s</div>
              <div><span className="text-muted-foreground">Token payload:</span> <code>{JSON.stringify(tokenPayload)}</code></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={probeWorker}>Probe worker (Range 0-1)</Button>
              <Button size="sm" variant="outline" asChild>
                <a href={signedUrl} target="_blank" rel="noreferrer">Open in new tab</a>
              </Button>
            </div>
            <audio controls src={signedUrl} className="w-full mt-2" />
            {headResult && <div className="text-xs font-mono p-2 bg-secondary/50 border border-border">{headResult}</div>}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Recent playback_events</div>
            <Button size="sm" variant="ghost" onClick={loadEvents} disabled={refreshing}>
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
            </Button>
          </div>
          <div className="border border-border max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Kind</th>
                  <th className="text-left p-2">Tier</th>
                  <th className="text-left p-2">Mismatch / Reason</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No events yet.</td></tr>
                )}
                {events.map((ev) => {
                  const isWorker = WORKER_KINDS.has(ev.event_kind);
                  const isDenied = ev.event_kind.startsWith("worker_denied_");
                  const reason = ev.metadata && typeof ev.metadata === "object"
                    ? ((ev.metadata as any).reason ?? (ev.metadata as any).mismatch ?? JSON.stringify(ev.metadata))
                    : "";
                  return (
                    <tr key={ev.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString()}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={isDenied ? "border-destructive/50 text-destructive" : isWorker ? "border-primary/50 text-primary" : ""}>
                          {ev.event_kind}
                        </Badge>
                      </td>
                      <td className="p-2">{ev.tier ?? "—"}</td>
                      <td className="p-2 font-mono text-[10px] max-w-md truncate" title={String(reason)}>{String(reason || "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerPlaybackTest;
