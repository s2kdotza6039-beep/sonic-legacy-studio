import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, RefreshCw, FlaskConical, FileDown, Wrench, ClipboardCheck, RotateCcw, Globe, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const WORKER_HOST = "https://newsingle.s2kdotza.com";


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
  id: "expired" | "bad_sig" | "path_mismatch" | "replay" | "rate_limit";
  label: string;
  expectStatus: number;
  expectKind: string;
  outcome: CheckOutcome;
  detail?: string;
};

const DEPLOY_STEPS: { id: string; label: string }[] = [
  { id: "login", label: "Ran npx wrangler login (workstation authenticated)" },
  { id: "kv", label: "Created REPLAY KV namespace and pasted id into wrangler.toml" },
  { id: "secret_hmac", label: "wrangler secret put R2_SIGNING_SECRET (same value as Supabase secret)" },
  { id: "secret_log", label: "wrangler secret put SUPABASE_LOG_URL (log-worker-playback URL)" },
  { id: "deploy", label: "npx wrangler deploy completed without errors" },
  { id: "route", label: "Route newsingle.s2kdotza.com/* bound to s2k-stream-gate in Cloudflare Triggers" },
  { id: "probe", label: "Probed a signed URL above — got 206 + worker_granted in events" },
  { id: "checks", label: "Automated worker checks (below) all green, including rate_limit" },
];
const DEPLOY_KEY = "s2k.phase2.deploy.checklist";


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
    { id: "rate_limit", label: "Per-IP minute bucket trips at limit", expectStatus: 429, expectKind: "worker_denied_rate_limit", outcome: "pending" },
  ]);
  const [runningChecks, setRunningChecks] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [deployChecks, setDeployChecks] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(DEPLOY_KEY) ?? "{}"); } catch { return {}; }
  });
  const [routeCheck, setRouteCheck] = useState<{ status: "idle" | "running" | "pass" | "fail"; detail?: string }>({ status: "idle" });
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "rate_limit" | "denied" | "run">("all");
  const [pdfInclude, setPdfInclude] = useState({ checklist: true, checks: true, events: true, rateLimit: true });
  const toggleDeploy = (id: string) => {
    setDeployChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(DEPLOY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const resetDeploy = () => {
    setDeployChecks({});
    try { localStorage.removeItem(DEPLOY_KEY); } catch { /* ignore */ }
    setRouteCheck({ status: "idle" });
    toast({ title: "Deploy checklist reset", description: "Re-run wrangler deploy verification when ready." });
  };
  const checkRouteBinding = async () => {
    setRouteCheck({ status: "running" });
    try {
      // Hit the worker host with no token. Our worker should respond with
      // 401 "missing token" via the worker, NOT a 404 / R2 default error.
      const r = await fetch(`${WORKER_HOST}/__route_probe.bin`, { method: "GET", cache: "no-store" });
      const cfRay = r.headers.get("cf-ray");
      const body = (await r.text()).slice(0, 120);
      const looksLikeWorker = r.status === 401 && /missing token|bad token|bad signature/i.test(body);
      if (looksLikeWorker && cfRay) {
        setRouteCheck({ status: "pass", detail: `${r.status} from worker (cf-ray=${cfRay}) — route bound correctly.` });
      } else if (r.status === 401 && /missing token/i.test(body)) {
        setRouteCheck({ status: "pass", detail: `${r.status} ${body} — worker responded but cf-ray missing.` });
      } else {
        setRouteCheck({
          status: "fail",
          detail: `Got ${r.status} ${r.statusText} — body: "${body}". Expected 401 "missing token" from s2k-stream-gate. Verify the route newsingle.s2kdotza.com/* is bound to the worker in Cloudflare → Workers → Triggers.`,
        });
      }
    } catch (e) {
      setRouteCheck({ status: "fail", detail: `network error: ${(e as Error).message} — DNS or worker may not be reachable.` });
    }
  };
  const allDeployDone = DEPLOY_STEPS.every((s) => deployChecks[s.id]);

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

  const mintTestUrl = async (mode: Check["id"]): Promise<string | null> => {
    if (!trackId) return null;
    const { data: { session } } = await supabase.auth.getSession();
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-track`);
    url.searchParams.set("track_id", trackId);
    url.searchParams.set("tier", tier);
    url.searchParams.set("json", "1");
    if (mode !== "replay") url.searchParams.set("test", mode);
    const r = await fetch(url.toString(), {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
    return body.url as string;
  };

  const probe = async (u: string) => {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-1" } });
    let text = "";
    try { text = (await r.text()).slice(0, 200); } catch { /* ignore */ }
    return { status: r.status, statusText: r.statusText, body: text };
  };

  // Rate-limit stress test: rapid-fire requests against a fresh signed URL
  // until the per-IP minute bucket trips, then assert a worker_denied_rate_limit
  // row appears in playback_events for this run.
  const runRateLimitCheck = async (updateCheck: (id: Check["id"], o: CheckOutcome, d: string) => void) => {
    const stressLimit = 160; // > RATE_LIMIT_PER_MIN default of 120
    const concurrency = 20;
    const startedAt = new Date();
    let url: string;
    try { url = (await mintTestUrl("replay"))!; } catch (e) { updateCheck("rate_limit", "fail", (e as Error).message); return; }
    let first429 = -1;
    let total429 = 0;
    let fired = 0;
    while (fired < stressLimit && first429 < 0) {
      const batch = Array.from({ length: concurrency }, (_, i) => fired + i)
        .filter((n) => n < stressLimit)
        .map(async (n) => {
          try {
            const r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
            if (r.status === 429) {
              total429++;
              if (first429 < 0) first429 = n + 1;
            }
          } catch { /* ignore */ }
        });
      await Promise.all(batch);
      fired += concurrency;
    }
    if (first429 < 0) {
      updateCheck("rate_limit", "fail", `fired ${fired} requests, never saw 429 — RATE_LIMIT_PER_MIN may be too high or Worker not deployed`);
      return;
    }
    // Confirm a denial row was logged.
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await supabase
      .from("playback_events")
      .select("id,created_at,metadata")
      .eq("event_kind", "worker_denied_rate_limit")
      .gte("created_at", startedAt.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (!data || data.length === 0) {
      updateCheck("rate_limit", "fail", `first 429 at request #${first429}, but no worker_denied_rate_limit row written within 1.5s`);
      return;
    }
    updateCheck("rate_limit", "pass", `first 429 at #${first429} (${total429} total) — logged ${new Date(data[0].created_at).toLocaleTimeString()}`);
  };

  const runChecks = async () => {
    if (!trackId) return;
    setRunningChecks(true);
    const next: Check[] = checks.map((c) => ({ ...c, outcome: "running", detail: undefined }));
    setChecks(next);

    const updateCheck = (id: Check["id"], outcome: CheckOutcome, detail: string) => {
      setChecks((prev) => prev.map((c) => c.id === id ? { ...c, outcome, detail } : c));
    };

    for (const c of next) {
      try {
        if (c.id === "rate_limit") {
          await runRateLimitCheck(updateCheck);
        } else if (c.id === "replay") {
          const url = await mintTestUrl("replay");
          if (!url) throw new Error("mint failed");
          const first = await probe(url);
          const second = await probe(url);
          if (first.status < 400 && second.status === c.expectStatus) {
            updateCheck(c.id, "pass", `1st=${first.status}, 2nd=${second.status} ${second.statusText}`);
          } else if (first.status < 400 && second.status < 400) {
            updateCheck(c.id, "fail", `replay NOT blocked (both ${first.status}) — Worker KV binding likely missing`);
          } else {
            updateCheck(c.id, "fail", `unexpected — 1st=${first.status}, 2nd=${second.status}`);
          }
        } else {
          const url = await mintTestUrl(c.id);
          if (!url) throw new Error("mint failed");
          const res = await probe(url);
          if (res.status === c.expectStatus) {
            updateCheck(c.id, "pass", `${res.status} ${res.statusText} — ${res.body}`);
          } else {
            updateCheck(c.id, "fail", `expected ${c.expectStatus}, got ${res.status} ${res.statusText} — ${res.body}`);
          }
        }
      } catch (e) {
        updateCheck(c.id, "fail", (e as Error).message);
      }
    }
    setRunningChecks(false);
    setTimeout(loadEvents, 1200);
  };

  const fixTrailingSpace = async () => {
    if (!selectedTrack) return;
    setRenaming(true);
    try {
      const { data, error } = await supabase.functions.invoke("r2-rename-track", {
        body: { track_id: selectedTrack.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "R2 object renamed",
        description: `${(data as any).from} → ${(data as any).to}`,
      });
      // Refresh tracks
      const { data: rows } = await supabase
        .from("tracks").select("id,title,artist_name,r2_object_key")
        .eq("is_active", true).order("title");
      setTracks(rows ?? []);
      loadEvents();
    } catch (e) {
      toast({ title: "Rename failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  const downloadAuditPdf = async () => {
    setGeneratingPdf(true);
    try {
      await loadEvents();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const now = new Date();
      doc.setFontSize(18);
      doc.text("S2K Phase 2 — Worker Audit Report", 40, 50);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated ${now.toLocaleString()}`, 40, 68);
      doc.text(`Track tested: ${selectedTrack?.title ?? "—"} (${selectedTrack?.artist_name ?? "—"})`, 40, 82);
      doc.text(`Tier: ${tier}`, 40, 96);
      doc.setTextColor(0);

      doc.setFontSize(12);
      doc.text("Deploy checklist", 40, 122);
      autoTable(doc, {
        startY: 130,
        styles: { fontSize: 9 },
        head: [["Step", "Status"]],
        body: DEPLOY_STEPS.map((s) => [s.label, deployChecks[s.id] ? "✓ done" : "pending"]),
      });

      const afterDeploy = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(12);
      doc.text("Automated worker checks", 40, afterDeploy);
      autoTable(doc, {
        startY: afterDeploy + 8,
        styles: { fontSize: 9 },
        head: [["Check", "Expected", "Outcome", "Detail"]],
        body: checks.map((c) => [c.label, `${c.expectStatus} ${c.expectKind}`, c.outcome, c.detail ?? "—"]),
        columnStyles: { 3: { cellWidth: 220 } },
      });

      const afterChecks = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(12);
      doc.text(`Recent playback_events (last ${events.length})`, 40, afterChecks);
      autoTable(doc, {
        startY: afterChecks + 8,
        styles: { fontSize: 8 },
        head: [["When", "Kind", "Tier", "Reason / metadata"]],
        body: events.slice(0, 60).map((ev) => {
          const reason = ev.metadata && typeof ev.metadata === "object"
            ? ((ev.metadata as any).reason ?? JSON.stringify(ev.metadata))
            : "";
          return [
            new Date(ev.created_at).toLocaleString(),
            ev.event_kind,
            ev.tier ?? "—",
            String(reason).slice(0, 120),
          ];
        }),
        columnStyles: { 3: { cellWidth: 230 } },
      });

      doc.save(`s2k-phase2-worker-audit-${now.toISOString().slice(0,19).replace(/[:T]/g, "-")}.pdf`);
    } catch (e) {
      toast({ title: "PDF failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
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
        <div className="border border-border p-3 space-y-2 bg-secondary/20">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ClipboardCheck size={14} className="text-primary" /> Phase 2 deploy checklist
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={allDeployDone ? "border-green-500/60 text-green-500" : "border-amber-500/60 text-amber-500"}>
                {allDeployDone ? "ready to mark Phase 2 complete" : `${DEPLOY_STEPS.filter(s=>deployChecks[s.id]).length}/${DEPLOY_STEPS.length} done`}
              </Badge>
              <Button size="sm" variant="outline" onClick={downloadAuditPdf} disabled={generatingPdf}>
                {generatingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Audit PDF
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            {DEPLOY_STEPS.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox checked={!!deployChecks[s.id]} onCheckedChange={() => toggleDeploy(s.id)} className="mt-0.5" />
                <span className={deployChecks[s.id] ? "text-muted-foreground line-through" : ""}>{s.label}</span>
              </label>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground pt-1">
            Do NOT mark Phase 2 complete until every box is ticked and all automated checks below are green.
          </div>
        </div>


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
            <div><span className="text-muted-foreground">Canonical (analytics):</span> <code>{canonical(selectedTrack.r2_object_key)}</code></div>
            <div className="flex gap-2 flex-wrap pt-1">
              {selectedTrack.r2_object_key !== decodedKey && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/50">percent-encoded — normalized before sign</Badge>
              )}
              {hasTrailingSpace(selectedTrack.r2_object_key) && (
                <>
                  <Badge variant="outline" className="text-destructive border-destructive/50">trailing-space anomaly — auto-rename available</Badge>
                  <Button size="sm" variant="outline" onClick={fixTrailingSpace} disabled={renaming}>
                    {renaming ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />} Rename R2 object + update DB
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Automated worker checks</div>
            <Button size="sm" onClick={runChecks} disabled={runningChecks || !trackId}>
              {runningChecks ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />} Run all
            </Button>
          </div>
          <div className="space-y-1">
            {checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={
                  c.outcome === "pass" ? "border-green-500/60 text-green-500" :
                  c.outcome === "fail" ? "border-destructive/60 text-destructive" :
                  c.outcome === "running" ? "border-primary/60 text-primary" : ""
                }>{c.outcome}</Badge>
                <div className="flex-1">
                  <div>{c.label} <span className="text-muted-foreground">→ expect {c.expectStatus} {c.expectKind}</span></div>
                  {c.detail && <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">Replay check expects KV-backed Worker (Phase 2). If first probe also fails, the Worker isn't deployed yet.</div>
        </div>


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
