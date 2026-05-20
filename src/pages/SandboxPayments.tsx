import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Circle, ExternalLink, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Track, startPayFast, submitPayFast, pollPaymentStatus,
  grantAccess, signedStreamUrl, loadAccess, loadRefs, clearAccess, formatZAR,
} from "@/lib/musicTier";
import { useAuth } from "@/contexts/AuthContext";

type Step = { id: string; label: string; status: "todo" | "doing" | "done" | "fail"; detail?: string };

const initialSteps = (): Step[] => [
  { id: "create",   label: "1. Create PayFast payment", status: "todo" },
  { id: "redirect", label: "2. Submit to PayFast checkout (new tab)", status: "todo" },
  { id: "notify",   label: "3. Await ITN webhook + poll status", status: "todo" },
  { id: "unlock",   label: "4. Grant local access + verify signed stream", status: "todo" },
];

export default function SandboxPayments() {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>(initialSteps());
  const [running, setRunning] = useState(false);
  const [mRef, setMRef] = useState<string | null>(null);
  const [access, setAccess] = useState(loadAccess());

  useEffect(() => {
    supabase.from("tracks").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as Track[];
        setTracks(list);
        if (list[0]) setTrackId(list[0].id);
      });
  }, []);

  const update = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const reset = () => { setSteps(initialSteps()); setMRef(null); };
  const wipe = () => { clearAccess(); setAccess({}); };

  const run = async (kind: "tier_standard" | "tier_gold" | "download") => {
    if (!trackId) return;
    reset(); setRunning(true);
    update("create", { status: "doing" });
    try {
      const { checkout_url, fields, m_payment_id } = await startPayFast({ track_id: trackId, kind });
      setMRef(m_payment_id);
      update("create", { status: "done", detail: `m_payment_id=${m_payment_id}` });

      update("redirect", { status: "doing", detail: "Opening PayFast sandbox in new tab…" });
      submitPayFast(checkout_url, fields, { target: "_blank" });
      update("redirect", { status: "done" });

      update("notify", { status: "doing" });
      let tries = 0;
      while (tries < 60) {
        tries++;
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await pollPaymentStatus(m_payment_id);
          update("notify", { status: "doing", detail: `tick ${tries} · status=${res.status}` });
          if (res.status === "paid") {
            update("notify", { status: "done", detail: `paid · kind=${res.kind}` });
            update("unlock", { status: "doing" });
            if (kind !== "download") {
              const tier = kind === "tier_gold" ? "gold" : "standard";
              grantAccess(trackId, tier, m_payment_id);
              setAccess(loadAccess());
              const track = tracks.find((t) => t.id === trackId)!;
              try {
                const s = await signedStreamUrl(track, tier, { ref: m_payment_id, jwt: session?.access_token });
                update("unlock", { status: "done", detail: `granted=${s.granted} pct=${s.pct} url ready` });
              } catch (e) {
                update("unlock", { status: "fail", detail: `stream-track failed: ${(e as Error).message}` });
              }
            } else {
              update("unlock", { status: "done", detail: `download_token=${res.download_token?.slice(0, 12)}…` });
            }
            break;
          }
          if (res.status === "failed" || res.status === "cancelled") {
            update("notify", { status: "fail", detail: res.status });
            break;
          }
        } catch (e) {
          update("notify", { status: "doing", detail: `tick ${tries} · ${(e as Error).message}` });
        }
      }
    } catch (e) {
      update("create", { status: "fail", detail: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-xs uppercase tracking-[0.4em] text-primary mb-2">Founder sandbox</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">PayFast Tier Checkout — End-to-End Test</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Drives a full tier-purchase loop in the active <code>PAYFAST_MODE</code>. Use PayFast sandbox cards in the popup.
        </p>

        <Card className="p-5 mb-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Track</label>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.artist_name} — {t.title} · S {formatZAR(t.price_standard_cents)} · G {formatZAR(t.price_gold_cents)} · D {formatZAR(t.price_download_cents)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("tier_standard")} disabled={running || !trackId} variant="secondary">Buy Standard</Button>
            <Button onClick={() => run("tier_gold")} disabled={running || !trackId} className="bg-gradient-to-br from-amber-400 to-yellow-600 text-black hover:opacity-90">Buy Gold</Button>
            <Button onClick={() => run("download")} disabled={running || !trackId} variant="outline">Buy Download</Button>
            <Button onClick={reset} disabled={running} variant="ghost">Reset steps</Button>
            <Button onClick={wipe} disabled={running} variant="ghost" className="text-destructive">Clear local access</Button>
          </div>
        </Card>

        <Card className="p-5 mb-6">
          <h2 className="font-display text-lg font-bold mb-4">Test steps</h2>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-3 text-sm">
                {s.status === "done" ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500" />
                  : s.status === "fail" ? <XCircle className="w-4 h-4 mt-0.5 text-destructive" />
                  : s.status === "doing" ? <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-primary" />
                  : <Circle className="w-4 h-4 mt-0.5 text-muted-foreground" />}
                <div className="flex-1">
                  <p className="font-medium">{s.label}</p>
                  {s.detail && <p className="text-xs text-muted-foreground font-mono break-all">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
          {mRef && (
            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              Watching m_payment_id <code className="text-foreground">{mRef}</code>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-bold mb-3">Current local unlocks</h2>
          {Object.keys(access).length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(access).map(([id, tier]) => {
                const t = tracks.find((x) => x.id === id);
                return (
                  <li key={id} className="flex items-center gap-2">
                    <Badge>{tier}</Badge>
                    <span>{t ? `${t.artist_name} — ${t.title}` : id}</span>
                    {loadRefs()[id] && <span className="text-xs text-muted-foreground">ref {loadRefs()[id].slice(0, 8)}…</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <a href="/listen" className="inline-flex items-center gap-1 mt-4 text-xs text-primary hover:underline">
            Open Listen page <ExternalLink className="w-3 h-3" />
          </a>
        </Card>

        <ReplayItnTool />
      </div>
    </Layout>
  );
}

function ReplayItnTool() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [count, setCount] = useState(3);

  const add = (l: string) => setLog((cur) => [...cur, l]);

  const run = async () => {
    setBusy(true); setLog([]);
    try {
      add("Fetching latest notify log row…");
      const { data, error } = await supabase
        .from("payfast_notify_log")
        .select("m_payment_id,raw_payload,outcome,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.raw_payload || !data.m_payment_id) {
        add("No previous ITN payload found. Run a sandbox checkout first.");
        return;
      }
      add(`Replaying m_payment_id=${data.m_payment_id} (last outcome=${data.outcome})`);
      const body = new URLSearchParams(data.raw_payload as Record<string, string>).toString();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payfast-notify`;
      for (let i = 1; i <= count; i++) {
        const t0 = performance.now();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const txt = await res.text();
        add(`#${i} → HTTP ${res.status} (${Math.round(performance.now() - t0)}ms) · ${txt}`);
      }
      // Confirm log captured idempotent skips
      await new Promise((r) => setTimeout(r, 800));
      const { data: recent } = await supabase
        .from("payfast_notify_log")
        .select("outcome,was_idempotent_skip,created_at")
        .eq("m_payment_id", data.m_payment_id)
        .order("created_at", { ascending: false })
        .limit(count + 1);
      const skips = (recent ?? []).filter((r) => r.was_idempotent_skip).length;
      add(`Audit log shows ${skips} idempotent-skip row(s) for this ref.`);
      const { data: pmt } = await supabase
        .from("payments").select("status,paid_at,amount_cents")
        .eq("m_payment_id", data.m_payment_id).maybeSingle();
      if (pmt) add(`Payment row unchanged: status=${pmt.status}, paid_at=${pmt.paid_at}, amount_cents=${pmt.amount_cents}`);
    } catch (e) {
      add(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 mt-6">
      <h2 className="font-display text-lg font-bold mb-1">Webhook idempotency rehearsal</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Re-POSTs the most recent ITN payload to <code>payfast-notify</code> multiple times to confirm
        repeats are logged as idempotent skips and never double-grant or mutate the payment row.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Repeats</label>
        <Input
          type="number" min={1} max={10} value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          className="w-20 h-8"
        />
        <Button onClick={run} disabled={busy} size="sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Replay last ITN
        </Button>
      </div>
      {log.length > 0 && (
        <pre className="text-[11px] font-mono bg-secondary/40 border border-border rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {log.join("\n")}
        </pre>
      )}
    </Card>
  );
}
      </div>
    </Layout>
  );
}
