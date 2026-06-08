import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, RefreshCw, FlaskConical, FileDown, Wrench, ClipboardCheck, RotateCcw, Globe, Eye, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const WORKER_HOST = "https://newsingle.s2kdotza.com";
const EXPECTED_ROUTE_PATTERN = "newsingle.s2kdotza.com/*";


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

function decodePayload(token: string): any {
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
  try { return decodeURIComponent(raw); } catch { return raw; }
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
  { id: "route", label: `Route ${EXPECTED_ROUTE_PATTERN} bound to s2k-stream-gate in Cloudflare Triggers` },
  { id: "probe", label: "Probed a signed URL above — got 206 + worker_granted in events" },
  { id: "checks", label: "Automated worker checks (below) all green, including rate_limit" },
];

type DeployRow = { step_id: string; checked: boolean; last_run_at: string | null };
type ConsistencyResult = {
  status: "idle" | "running" | "pass" | "fail";
  sampled: number;
  mismatches: { track_id: string; title: string; stored: string; token_p: string; reason: string }[];
  ranAt?: string;
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
    { id: "rate_limit", label: "Per-IP minute bucket trips at limit", expectStatus: 429, expectKind: "worker_denied_rate_limit", outcome: "pending" },
  ]);
  const [runningChecks, setRunningChecks] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [deployRows, setDeployRows] = useState<Record<string, DeployRow>>({});
  const [deployLoading, setDeployLoading] = useState(true);
  const [routeCheck, setRouteCheck] = useState<{
    status: "idle" | "running" | "pass" | "fail";
    detail?: string;
    expected?: { host: string; route: string; probeUrl: string };
    actual?: { status: number; statusText: string; bodySnippet: string; cfRay: string | null; server: string | null };
    curlSnippet?: string;
  }>({ status: "idle" });
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "rate_limit" | "denied" | "run">("all");
  const [pdfInclude, setPdfInclude] = useState({ checklist: true, checks: true, events: true, rateLimit: true });
  const [consistency, setConsistency] = useState<ConsistencyResult>({ status: "idle", sampled: 0, mismatches: [] });

  // ---- Deploy checklist persistence (DB) ----
  const loadDeployState = async () => {
    setDeployLoading(true);
    const { data } = await supabase
      .from("phase2_deploy_state")
      .select("step_id,checked,last_run_at");
    const map: Record<string, DeployRow> = {};
    (data ?? []).forEach((r: any) => { map[r.step_id] = r; });
    setDeployRows(map);
    setDeployLoading(false);
  };
  useEffect(() => { loadDeployState(); }, []);

  const persistStep = async (stepId: string, patch: Partial<DeployRow>) => {
    const now = new Date().toISOString();
    const existing = deployRows[stepId];
    const next: DeployRow = {
      step_id: stepId,
      checked: patch.checked ?? existing?.checked ?? false,
      last_run_at: patch.last_run_at ?? existing?.last_run_at ?? null,
    };
    setDeployRows((prev) => ({ ...prev, [stepId]: next }));
    const { error } = await supabase
      .from("phase2_deploy_state")
      .upsert({ ...next, updated_at: now }, { onConflict: "step_id" });
    if (error) {
      toast({ title: "Could not save checklist", description: error.message, variant: "destructive" });
    }
  };

  const toggleDeploy = (id: string) => {
    const wasChecked = !!deployRows[id]?.checked;
    persistStep(id, {
      checked: !wasChecked,
      last_run_at: !wasChecked ? new Date().toISOString() : deployRows[id]?.last_run_at ?? null,
    });
  };

  const resetDeploy = async () => {
    const { error } = await supabase.from("phase2_deploy_state").delete().neq("step_id", "");
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    setDeployRows({});
    setRouteCheck({ status: "idle" });
    toast({ title: "Deploy checklist reset", description: "Re-run wrangler deploy verification when ready." });
  };

  const allDeployDone = DEPLOY_STEPS.every((s) => deployRows[s.id]?.checked);

  // ---- Route binding probe (enhanced) ----
  const checkRouteBinding = async () => {
    const probeUrl = `${WORKER_HOST}/__route_probe.bin`;
    const expected = { host: WORKER_HOST, route: EXPECTED_ROUTE_PATTERN, probeUrl };
    const curlSnippet = `curl -i '${probeUrl}'   # expect: HTTP/2 401 + body "missing token" + cf-ray header`;
    setRouteCheck({ status: "running", expected, curlSnippet });
    try {
      const r = await fetch(probeUrl, { method: "GET", cache: "no-store" });
      const cfRay = r.headers.get("cf-ray");
      const server = r.headers.get("server");
      const body = (await r.text()).slice(0, 160);
      const actual = { status: r.status, statusText: r.statusText, bodySnippet: body, cfRay, server };
      const looksLikeWorker = r.status === 401 && /missing token|bad token|bad signature/i.test(body);
      if (looksLikeWorker && cfRay) {
        setRouteCheck({ status: "pass", expected, actual, curlSnippet, detail: `Worker responded as expected (cf-ray=${cfRay}).` });
        await persistStep("route", { checked: true, last_run_at: new Date().toISOString() });
      } else if (looksLikeWorker) {
        setRouteCheck({ status: "pass", expected, actual, curlSnippet, detail: "Worker responded but no cf-ray header — still considered bound." });
      } else {
        setRouteCheck({
          status: "fail",
          expected, actual, curlSnippet,
          detail: `Expected 401 "missing token" from s2k-stream-gate. Got ${r.status} ${r.statusText}. Verify route ${EXPECTED_ROUTE_PATTERN} is bound in Cloudflare → Workers → Triggers.`,
        });
      }
    } catch (e) {
      setRouteCheck({
        status: "fail", expected, curlSnippet,
        detail: `Network error: ${(e as Error).message} — DNS or worker may not be reachable.`,
      });
    }
  };

  // ---- Track + events loading ----
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
  const tokenPayload = signedUrl ? decodePayload(new URL(signedUrl).searchParams.get("t") ?? "") : null;

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

  // ---- Mint helpers ----
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

  const runRateLimitCheck = async (updateCheck: (id: Check["id"], o: CheckOutcome, d: string) => void) => {
    const stressLimit = 160;
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
    setRunStartedAt(new Date().toISOString());
    setEventFilter("run");
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
    await persistStep("checks", { last_run_at: new Date().toISOString() });
    setTimeout(loadEvents, 1200);
  };

  // ---- Post-deploy consistency check (token p vs decoded key) ----
  const runConsistencyCheck = async () => {
    setConsistency({ status: "running", sampled: 0, mismatches: [] });
    const sample = tracks.slice(0, Math.min(20, tracks.length));
    const mismatches: ConsistencyResult["mismatches"] = [];
    const { data: { session } } = await supabase.auth.getSession();
    for (const t of sample) {
      try {
        const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-track`);
        url.searchParams.set("track_id", t.id);
        url.searchParams.set("tier", "free");
        url.searchParams.set("json", "1");
        const r = await fetch(url.toString(), {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const body = await r.json();
        if (!r.ok) {
          mismatches.push({ track_id: t.id, title: t.title, stored: t.r2_object_key, token_p: "", reason: `mint failed: ${body.error ?? r.status}` });
          continue;
        }
        const tok = new URL(body.url).searchParams.get("t") ?? "";
        const payload = decodePayload(tok);
        const tokenP = String(payload?.p ?? "");
        const decoded = normalize(t.r2_object_key);
        if (tokenP !== decoded) {
          mismatches.push({
            track_id: t.id, title: t.title, stored: t.r2_object_key, token_p: tokenP,
            reason: `token.p !== normalize(stored). diff length stored=${decoded.length} token=${tokenP.length}`,
          });
        }
      } catch (e) {
        mismatches.push({ track_id: t.id, title: t.title, stored: t.r2_object_key, token_p: "", reason: (e as Error).message });
      }
    }
    const result: ConsistencyResult = {
      status: mismatches.length === 0 ? "pass" : "fail",
      sampled: sample.length,
      mismatches,
      ranAt: new Date().toISOString(),
    };
    setConsistency(result);
    toast({
      title: result.status === "pass" ? "Consistency check passed" : "Consistency check failed",
      description: `Sampled ${sample.length} tracks · ${mismatches.length} mismatches`,
      variant: result.status === "pass" ? "default" : "destructive",
    });
  };

  // ---- R2 rename ----
  const fixTrailingSpace = async (dryRun = false) => {
    if (!selectedTrack) return;
    setRenaming(true);
    if (dryRun) setDryRunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("r2-rename-track", {
        body: { track_id: selectedTrack.id, dry_run: dryRun },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (dryRun) {
        setDryRunResult(data);
        const w = (data as any).worker ?? {};
        const detail = (data as any).noop
          ? "Already canonical — no rename needed."
          : `Would rename ${(data as any).from} → ${(data as any).to}` +
            (w.would_succeed === false
              ? w.destination_exists
                ? " · BLOCKED: destination already exists"
                : !w.source_exists
                  ? " · BLOCKED: source missing"
                  : ""
              : "");
        toast({ title: "Dry run complete", description: detail });
      } else {
        setDryRunResult(null);
        toast({ title: "R2 object renamed", description: `${(data as any).from} → ${(data as any).to}` });
        const { data: rows } = await supabase
          .from("tracks").select("id,title,artist_name,r2_object_key")
          .eq("is_active", true).order("title");
        setTracks(rows ?? []);
        loadEvents();
      }
    } catch (e) {
      toast({ title: dryRun ? "Dry run failed" : "Rename failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  // ---- Event filtering helper ----
  const filteredEvents = useMemo(() => events.filter((ev) => {
    if (eventFilter === "rate_limit") return ev.event_kind === "worker_denied_rate_limit";
    if (eventFilter === "denied") return ev.event_kind.startsWith("worker_denied_");
    if (eventFilter === "run" && runStartedAt) return ev.created_at >= runStartedAt;
    return true;
  }), [events, eventFilter, runStartedAt]);

  // ---- Export events ----
  const downloadEvents = (format: "json" | "csv") => {
    if (filteredEvents.length === 0) {
      toast({ title: "Nothing to export", description: "No events match the current filter.", variant: "destructive" });
      return;
    }
    const rows = filteredEvents.map((ev) => {
      const md = (ev.metadata && typeof ev.metadata === "object") ? (ev.metadata as any) : {};
      return {
        id: ev.id,
        created_at: ev.created_at,
        event_kind: ev.event_kind,
        tier: ev.tier ?? "",
        track_id: ev.track_id ?? "",
        cf_ray: md.ray ?? "",
        ip: md.ip ?? "",
        reason: md.reason ?? md.mismatch ?? "",
        path: md.path ?? "",
        metadata: md,
      };
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    let blob: Blob;
    let filename: string;
    if (format === "json") {
      blob = new Blob([JSON.stringify({
        exported_at: new Date().toISOString(),
        filter: eventFilter,
        run_started_at: runStartedAt,
        count: rows.length,
        events: rows,
      }, null, 2)], { type: "application/json" });
      filename = `playback-events-${eventFilter}-${stamp}.json`;
    } else {
      const headers = ["id", "created_at", "event_kind", "tier", "track_id", "cf_ray", "ip", "reason", "path"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [headers.join(",")];
      rows.forEach((r) => lines.push(headers.map((h) => esc((r as any)[h])).join(",")));
      blob = new Blob([lines.join("\n")], { type: "text/csv" });
      filename = `playback-events-${eventFilter}-${stamp}.csv`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---- Audit PDF ----
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

      let cursorY = 122;
      const rateLimitCheck = checks.find((c) => c.id === "rate_limit");
      const nonRateChecks = checks.filter((c) => c.id !== "rate_limit");

      if (pdfInclude.checklist) {
        doc.setFontSize(12);
        doc.text("Deploy checklist", 40, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          styles: { fontSize: 9 },
          head: [["Step", "Status", "Last run"]],
          body: DEPLOY_STEPS.map((s) => {
            const row = deployRows[s.id];
            return [
              s.label,
              row?.checked ? "✓ done" : "pending",
              row?.last_run_at ? new Date(row.last_run_at).toLocaleString() : "—",
            ];
          }),
        });
        cursorY = (doc as any).lastAutoTable.finalY + 20;
        if (routeCheck.status !== "idle") {
          doc.setFontSize(9);
          doc.text(`Route binding: ${routeCheck.status.toUpperCase()} — ${routeCheck.detail ?? ""}`.slice(0, 180), 40, cursorY);
          cursorY += 16;
        }
      }

      if (pdfInclude.checks) {
        doc.setFontSize(12);
        doc.text("Automated worker checks", 40, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          styles: { fontSize: 9 },
          head: [["Check", "Expected", "Outcome", "Detail"]],
          body: nonRateChecks.map((c) => [c.label, `${c.expectStatus} ${c.expectKind}`, c.outcome, c.detail ?? "—"]),
          columnStyles: { 3: { cellWidth: 220 } },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 20;
      }

      if (pdfInclude.rateLimit && rateLimitCheck) {
        doc.setFontSize(12);
        doc.text("Rate-limit stress test", 40, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          styles: { fontSize: 9 },
          head: [["Check", "Expected", "Outcome", "Detail"]],
          body: [[rateLimitCheck.label, `${rateLimitCheck.expectStatus} ${rateLimitCheck.expectKind}`, rateLimitCheck.outcome, rateLimitCheck.detail ?? "—"]],
          columnStyles: { 3: { cellWidth: 220 } },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 20;
      }

      if (pdfInclude.events) {
        const eventsForPdf = events.slice(0, 60);
        doc.setFontSize(12);
        doc.text(`Recent playback_events (last ${eventsForPdf.length})`, 40, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          styles: { fontSize: 8 },
          head: [["When", "Kind", "Tier", "cf-ray", "Reason / metadata"]],
          body: eventsForPdf.map((ev) => {
            const md = (ev.metadata && typeof ev.metadata === "object") ? (ev.metadata as any) : {};
            const reason = md.reason ?? JSON.stringify(md);
            return [
              new Date(ev.created_at).toLocaleString(),
              ev.event_kind,
              ev.tier ?? "—",
              String(md.ray ?? "—"),
              String(reason).slice(0, 120),
            ];
          }),
          columnStyles: { 4: { cellWidth: 200 } },
        });
      }

      doc.save(`s2k-phase2-worker-audit-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`);
    } catch (e) {
      toast({ title: "PDF failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const dryRunWorker = dryRunResult?.worker ?? null;
  const dryRunDiff = dryRunResult ? (() => {
    const srcSize = dryRunWorker?.source_bytes ?? null;
    const dstSize = dryRunWorker?.destination_bytes ?? null;
    const collision = dryRunWorker?.destination_exists === true;
    const sourceMissing = dryRunWorker?.source_exists === false;
    const delta = (srcSize !== null && dstSize !== null) ? srcSize - dstSize : null;
    const beforeName = String(dryRunResult.from ?? "");
    const afterName = String(dryRunResult.to ?? "");
    return {
      noop: !!dryRunResult.noop,
      collision,
      sourceMissing,
      srcSize, dstSize, delta,
      beforeName, afterName,
      wouldSucceed: dryRunWorker?.would_succeed ?? (!collision && !sourceMissing),
      objectCountBefore: sourceMissing ? 0 : 1,
      objectCountAfter: collision || sourceMissing ? (collision ? 1 : 0) : 1,
    };
  })() : null;

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
              {deployLoading && <Loader2 size={10} className="animate-spin" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={allDeployDone ? "border-green-500/60 text-green-500" : "border-amber-500/60 text-amber-500"}>
                {allDeployDone ? "ready to mark Phase 2 complete" : `${DEPLOY_STEPS.filter((s) => deployRows[s.id]?.checked).length}/${DEPLOY_STEPS.length} done`}
              </Badge>
              <Button size="sm" variant="outline" onClick={checkRouteBinding} disabled={routeCheck.status === "running"}>
                {routeCheck.status === "running" ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />} Verify route binding
              </Button>
              <Button size="sm" variant="outline" onClick={resetDeploy}>
                <RotateCcw size={12} /> Reset checklist
              </Button>
              <Button size="sm" variant="outline" onClick={downloadAuditPdf} disabled={generatingPdf}>
                {generatingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Audit PDF
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            {DEPLOY_STEPS.map((s) => {
              const row = deployRows[s.id];
              return (
                <label key={s.id} className="flex items-start gap-2 text-xs cursor-pointer">
                  <Checkbox checked={!!row?.checked} onCheckedChange={() => toggleDeploy(s.id)} className="mt-0.5" />
                  <span className={`flex-1 ${row?.checked ? "text-muted-foreground line-through" : ""}`}>{s.label}</span>
                  {row?.last_run_at && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(row.last_run_at).toLocaleString()}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {routeCheck.status !== "idle" && (
            <div className={`text-[10px] font-mono p-2 border space-y-1 ${
              routeCheck.status === "pass" ? "border-green-500/40 bg-green-500/5 text-green-500" :
              routeCheck.status === "fail" ? "border-destructive/40 bg-destructive/5 text-destructive" :
              "border-border bg-secondary/30 text-muted-foreground"
            }`}>
              <div><span className="uppercase tracking-widest mr-2">route check: {routeCheck.status}</span>{routeCheck.detail}</div>
              {routeCheck.expected && (
                <div className="text-foreground/70">
                  <div>expected route: <code>{routeCheck.expected.route}</code> → worker <code>s2k-stream-gate</code></div>
                  <div>probe URL: <code>{routeCheck.expected.probeUrl}</code></div>
                </div>
              )}
              {routeCheck.actual && (
                <div className="text-foreground/70">
                  <div>actual: HTTP <code>{routeCheck.actual.status} {routeCheck.actual.statusText}</code> · cf-ray=<code>{routeCheck.actual.cfRay ?? "—"}</code> · server=<code>{routeCheck.actual.server ?? "—"}</code></div>
                  <div className="break-all">body: <code>{routeCheck.actual.bodySnippet}</code></div>
                </div>
              )}
              {routeCheck.curlSnippet && (
                <div className="text-foreground/80 select-all break-all">repro: <code>{routeCheck.curlSnippet}</code></div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50 mt-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Audit PDF includes:</span>
            {([
              ["checklist", "Checklist"],
              ["checks", "Automated checks"],
              ["events", "Last 60 playback_events"],
              ["rateLimit", "Rate-limit results"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Checkbox checked={(pdfInclude as any)[k]} onCheckedChange={() => setPdfInclude((p) => ({ ...p, [k]: !(p as any)[k] }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground pt-1">
            Do NOT mark Phase 2 complete until every box is ticked and all automated checks below are green.
          </div>
        </div>

        {/* Post-deploy consistency check */}
        <div className="border border-border p-3 space-y-2 bg-secondary/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary" /> Post-deploy consistency check
            </div>
            <div className="flex items-center gap-2">
              {consistency.status !== "idle" && (
                <Badge variant="outline" className={
                  consistency.status === "pass" ? "border-green-500/60 text-green-500" :
                  consistency.status === "fail" ? "border-destructive/60 text-destructive" :
                  "border-primary/60 text-primary"
                }>
                  {consistency.status} · {consistency.sampled} sampled · {consistency.mismatches.length} mismatch{consistency.mismatches.length === 1 ? "" : "es"}
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={runConsistencyCheck} disabled={consistency.status === "running" || tracks.length === 0}>
                {consistency.status === "running" ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Check sample tracks
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Mints a free-tier token for up to 20 tracks and verifies <code>token.p === decodeURIComponent(r2_object_key)</code> — the exact bytes the Worker compares against.
          </p>
          {consistency.mismatches.length > 0 && (
            <div className="border border-destructive/40 bg-destructive/5 p-2 max-h-48 overflow-auto">
              <table className="w-full text-[10px] font-mono">
                <thead className="text-destructive uppercase tracking-widest">
                  <tr><th className="text-left">Track</th><th className="text-left">Stored</th><th className="text-left">Token.p</th><th className="text-left">Reason</th></tr>
                </thead>
                <tbody>
                  {consistency.mismatches.map((m) => (
                    <tr key={m.track_id} className="border-t border-border/40">
                      <td className="pr-2">{m.title}</td>
                      <td className="pr-2 break-all">{m.stored}</td>
                      <td className="pr-2 break-all">{m.token_p || "—"}</td>
                      <td className="pr-2">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Track</label>
            <select value={trackId} onChange={(e) => setTrackId(e.target.value)} className="w-full mt-1 bg-background border border-border px-3 py-2 text-sm">
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.artist_name ?? "—"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="w-full mt-1 bg-background border border-border px-3 py-2 text-sm">
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
                  <Button size="sm" variant="outline" onClick={() => fixTrailingSpace(true)} disabled={renaming}>
                    {renaming ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Dry run
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fixTrailingSpace(false)}
                    disabled={renaming || (dryRunDiff ? dryRunDiff.collision || dryRunDiff.sourceMissing : false)}
                    title={dryRunDiff?.collision ? "Destination already exists — dry run blocked the rename" : dryRunDiff?.sourceMissing ? "Source object missing — cannot rename" : ""}
                  >
                    {renaming ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />} Rename R2 object + update DB
                  </Button>
                </>
              )}
            </div>
            {dryRunResult && dryRunDiff && (
              <div className="mt-2 border border-amber-500/40 bg-amber-500/5 p-2 text-[10px] font-mono space-y-1">
                <div className="text-amber-500 uppercase tracking-widest text-[9px]">Dry-run diff (no changes applied)</div>
                {dryRunDiff.noop ? (
                  <div>Already canonical — no rename needed.</div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="text-muted-foreground">
                        <tr><th className="text-left"> </th><th className="text-left">Before (from)</th><th className="text-left">After (to)</th><th className="text-left">Δ</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>object key</td>
                          <td className="break-all">{dryRunDiff.beforeName}</td>
                          <td className="break-all">{dryRunDiff.afterName}</td>
                          <td>{dryRunDiff.beforeName.length} → {dryRunDiff.afterName.length} ({dryRunDiff.afterName.length - dryRunDiff.beforeName.length >= 0 ? "+" : ""}{dryRunDiff.afterName.length - dryRunDiff.beforeName.length})</td>
                        </tr>
                        <tr>
                          <td>r2 object count</td>
                          <td>{dryRunDiff.objectCountBefore}</td>
                          <td>{dryRunDiff.collision ? 2 : 1} (post-put, pre-delete)</td>
                          <td>net 0 after delete</td>
                        </tr>
                        <tr>
                          <td>bytes</td>
                          <td>{dryRunDiff.srcSize ?? "—"}</td>
                          <td>{dryRunDiff.dstSize ?? (dryRunDiff.srcSize ?? "—")}</td>
                          <td>{dryRunDiff.delta === null ? "—" : `${dryRunDiff.delta >= 0 ? "+" : ""}${dryRunDiff.delta}`}</td>
                        </tr>
                      </tbody>
                    </table>
                    {dryRunDiff.collision && (
                      <div className="text-destructive">⚠ Naming collision: destination object already exists in R2. Resolve before running the rename.</div>
                    )}
                    {dryRunDiff.sourceMissing && (
                      <div className="text-destructive">⚠ Source object not found in R2. Cannot proceed.</div>
                    )}
                    {!dryRunDiff.collision && !dryRunDiff.sourceMissing && (
                      <div className="text-green-500">✓ Safe to rename — no collision, source present.</div>
                    )}
                  </>
                )}
                {dryRunResult.current_db_key && <div>current db key: <code>{String(dryRunResult.current_db_key)}</code></div>}
                {dryRunResult.proposed_db_key && <div>proposed db key: <code>{String(dryRunResult.proposed_db_key)}</code></div>}
              </div>
            )}
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Recent playback_events ({filteredEvents.length} shown)
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as typeof eventFilter)}
                className="bg-background border border-border px-2 py-1 text-[11px]"
              >
                <option value="all">All events</option>
                <option value="denied">All worker_denied_*</option>
                <option value="rate_limit">worker_denied_rate_limit only</option>
                <option value="run" disabled={!runStartedAt}>This test run{runStartedAt ? ` (since ${new Date(runStartedAt).toLocaleTimeString()})` : ""}</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => downloadEvents("json")} disabled={filteredEvents.length === 0}>
                <FileDown size={12} /> JSON
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadEvents("csv")} disabled={filteredEvents.length === 0}>
                <FileDown size={12} /> CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={loadEvents} disabled={refreshing}>
                {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
              </Button>
            </div>
          </div>
          <div className="border border-border max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Kind</th>
                  <th className="text-left p-2">Tier</th>
                  <th className="text-left p-2">Request ID (cf-ray)</th>
                  <th className="text-left p-2">Mismatch / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No events match this filter.</td></tr>
                ) : filteredEvents.map((ev) => {
                  const isWorker = WORKER_KINDS.has(ev.event_kind);
                  const isDenied = ev.event_kind.startsWith("worker_denied_");
                  const md = (ev.metadata && typeof ev.metadata === "object") ? (ev.metadata as any) : {};
                  const reason = md.reason ?? md.mismatch ?? JSON.stringify(md);
                  const ray = md.ray ?? "—";
                  return (
                    <tr key={ev.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={isDenied ? "border-destructive/50 text-destructive" : isWorker ? "border-primary/50 text-primary" : ""}>
                          {ev.event_kind}
                        </Badge>
                      </td>
                      <td className="p-2">{ev.tier ?? "—"}</td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{String(ray)}</td>
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
