import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Play, Pause, Download, Lock, Crown, Sparkles, Music2, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Track, Tier, tierPercentage, tierRank,
  loadAccess, loadRefs, grantAccess,
  signedStreamUrl, startPayFast, submitPayFast,
  pollPaymentStatus, downloadUrl, formatZAR, kindToTier,
  enforceCap, clampSeekTarget, resolveResumePosition,
} from "@/lib/musicTier";

const TIER_META: Record<Tier, { label: string; pct: string; icon: typeof Crown; gradient: string }> = {
  free:     { label: "Free",     pct: "25%",  icon: Sparkles, gradient: "from-slate-500 to-slate-700" },
  standard: { label: "Standard", pct: "55%",  icon: Music2,   gradient: "from-sky-500 to-indigo-600" },
  gold:     { label: "Gold",     pct: "100%", icon: Crown,    gradient: "from-amber-400 to-yellow-600" },
  cristal:  { label: "Cristal",  pct: "100%", icon: Lock,     gradient: "from-fuchsia-500 to-purple-700" },
};

const RESUME_KEY = "s2k.resume.v1";
type ResumeMap = Record<string, number>;
const loadResume = (): ResumeMap => {
  try { return JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? "{}"); } catch { return {}; }
};
const saveResume = (id: string, t: number) => {
  const r = loadResume(); r[id] = t; sessionStorage.setItem(RESUME_KEY, JSON.stringify(r));
};

export default function Listen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(loadAccess());
  const [active, setActive] = useState<string | null>(null);
  const { isFounder } = useUserRole();

  useEffect(() => {
    supabase.from("tracks").select("*").eq("is_active", true)
      .order("sort_order").then(({ data }) => {
        setTracks((data ?? []) as Track[]);
        setLoading(false);
      });
  }, []);

  const refreshAccess = useCallback(() => setAccess({ ...loadAccess() }), []);

  return (
    <Layout>
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-12 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-primary mb-3">New Singles</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">Listen Now</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Pick a tier. Free preview, Standard 55%, Gold full song, or unlock Cristal as a founder.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {tracks.map((t) => (
                <TrackCard
                  key={t.id}
                  track={t}
                  unlockedTier={access[t.id] ?? "free"}
                  isFounder={isFounder}
                  isActive={active === t.id}
                  onActivate={() => setActive(t.id)}
                  onAccessChange={refreshAccess}
                />
              ))}
            </div>
          )}

          <PaymentReturnHandler onAccessChange={refreshAccess} />
        </div>
      </section>
    </Layout>
  );
}

function TrackCard({
  track, unlockedTier, isFounder, isActive, onActivate, onAccessChange,
}: {
  track: Track; unlockedTier: Tier; isFounder: boolean;
  isActive: boolean; onActivate: () => void; onAccessChange: () => void;
}) {
  const [showTiers, setShowTiers] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(false);
  const [paying, setPaying] = useState<Tier | "download" | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const { session } = useAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(track.duration_seconds ?? 0);
  const [progress, setProgress] = useState(0);

  const effectiveTier: Tier = isFounder ? "cristal" : unlockedTier;
  const allowedSec = duration * tierPercentage(track, effectiveTier);
  const capped = effectiveTier !== "gold" && effectiveTier !== "cristal";

  const ensureAudio = async (tier: Tier): Promise<HTMLAudioElement | null> => {
    setLoadingUrl(true);
    try {
      const ref = loadRefs()[track.id] ?? null;
      const { url } = await signedStreamUrl(track, tier, {
        ref, jwt: session?.access_token ?? null,
      });
      let a = audioRef.current;
      if (!a) { a = new Audio(); audioRef.current = a; }
      if (a.src !== url) a.src = url;
      return a;
    } catch (e) {
      toast.error("Could not load stream", { description: (e as Error).message });
      return null;
    } finally {
      setLoadingUrl(false);
    }
  };

  const handlePlay = async (tier: Tier) => {
    onActivate();
    setShowTiers(false);
    if (tier === "cristal" && !isFounder) {
      toast.error("Cristal is administrator-only.");
      return;
    }
    if ((tier === "standard" || tier === "gold") && tierRank[unlockedTier] < tierRank[tier]) {
      return startCheckout(tier === "gold" ? "tier_gold" : "tier_standard");
    }
    const a = await ensureAudio(tier);
    if (!a) return;
    const resume = loadResume()[track.id];
    if (resume && resume < a.duration * tierPercentage(track, tier)) a.currentTime = resume;
    a.play().then(() => setPlaying(true)).catch(() => toast.error("Playback failed"));
  };

  const startCheckout = async (kind: "tier_standard" | "tier_gold" | "download") => {
    setPaying(kind === "download" ? "download" : kindToTier(kind)!);
    try {
      const { checkout_url, fields, m_payment_id } = await startPayFast({
        track_id: track.id, kind,
      });
      sessionStorage.setItem(`pf.pending.${m_payment_id}`, JSON.stringify({ track_id: track.id, kind }));
      if (audioRef.current) saveResume(track.id, audioRef.current.currentTime);
      submitPayFast(checkout_url, fields);
    } catch {
      toast.error("Could not start checkout");
      setPaying(null);
    }
  };

  // Playback monitor: enforce cap on time updates AND on seek attempts.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const enforce = () => {
      if (capped && allowedSec > 0 && a.currentTime > allowedSec) {
        a.currentTime = Math.max(0, allowedSec - 0.25);
        if (!a.paused) {
          a.pause();
          setPlaying(false);
          setUpgradePrompt(true);
        }
      }
      setProgress(a.currentTime);
      saveResume(track.id, a.currentTime);
    };
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", enforce);
    a.addEventListener("seeking", enforce);
    a.addEventListener("seeked", enforce);
    a.addEventListener("ratechange", enforce);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    // Continuous watchdog catches any source that bypasses 'seeking' (mobile scrub edge cases)
    const watchdog = window.setInterval(enforce, 250);
    return () => {
      a.removeEventListener("timeupdate", enforce);
      a.removeEventListener("seeking", enforce);
      a.removeEventListener("seeked", enforce);
      a.removeEventListener("ratechange", enforce);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      window.clearInterval(watchdog);
    };
  }, [allowedSec, capped, track.id]);

  const togglePause = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    if (capped && target > allowedSec) {
      a.currentTime = Math.max(0, allowedSec - 0.25);
      setUpgradePrompt(true);
    } else {
      a.currentTime = target;
    }
  };

  const standardGain = Math.round((Number(track.pct_standard) - Number(track.pct_free)) * 100);

  return (
    <div className={`group relative border border-border bg-card/40 backdrop-blur-sm rounded-2xl overflow-hidden transition-all ${isActive ? "ring-1 ring-primary/40" : ""}`}>
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{track.artist_name}</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold">{track.title}</h2>
          </div>
          <TierBadge tier={effectiveTier} />
        </div>

        <div onClick={onSeek} className="cursor-pointer mb-2 relative">
          <Progress value={duration ? (progress / duration) * 100 : 0} className="h-1" />
          {capped && allowedSec > 0 && duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-primary/60"
              style={{ left: `${(allowedSec / duration) * 100}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-6 tabular-nums">
          <span>{fmt(progress)}</span>
          <span>
            {capped && allowedSec > 0 ? `${fmt(allowedSec)} limit · ` : ""}
            {fmt(duration)}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {playing ? (
            <Button onClick={togglePause} size="lg" variant="secondary" className="rounded-full px-6">
              <Pause /> Pause
            </Button>
          ) : (
            <Button data-track-play={track.id} onClick={() => setShowTiers(true)} size="lg" className="rounded-full px-6 bg-primary hover:bg-primary/90" disabled={loadingUrl}>
              {loadingUrl ? <Loader2 className="animate-spin" /> : <Play />} Listen Now
            </Button>
          )}
          <Button onClick={() => startCheckout("download")} size="lg" variant="outline" className="rounded-full px-6" disabled={paying === "download"}>
            {paying === "download" ? <Loader2 className="animate-spin" /> : <Download />}
            Download — {formatZAR(track.price_download_cents)}
          </Button>
        </div>
      </div>

      <TierPicker
        open={showTiers} onClose={() => setShowTiers(false)}
        track={track} unlockedTier={unlockedTier}
        isFounder={isFounder} paying={paying as Tier | null} onPick={handlePlay}
      />

      <UpgradeDialog
        open={upgradePrompt} onClose={() => setUpgradePrompt(false)}
        track={track} standardGain={standardGain}
        onUpgrade={(k) => { setUpgradePrompt(false); startCheckout(k); }}
      />
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const m = TIER_META[tier]; const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs uppercase tracking-widest text-white bg-gradient-to-br ${m.gradient}`}>
      <Icon className="w-3.5 h-3.5" /> {m.label}
    </span>
  );
}

function TierPicker({
  open, onClose, track, unlockedTier, isFounder, paying, onPick,
}: {
  open: boolean; onClose: () => void; track: Track;
  unlockedTier: Tier; isFounder: boolean; paying: Tier | null;
  onPick: (t: Tier) => void;
}) {
  const tiers: { tier: Tier; price?: string; sub: string }[] = [
    { tier: "free", sub: `${Math.round(Number(track.pct_free) * 100)}% preview` },
    { tier: "standard", price: formatZAR(track.price_standard_cents), sub: `${Math.round(Number(track.pct_standard) * 100)}% playback` },
    { tier: "gold", price: formatZAR(track.price_gold_cents), sub: "Full song" },
    { tier: "cristal", sub: isFounder ? "Founder access" : "Admin only" },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your tier</DialogTitle>
          <DialogDescription>{track.artist_name} — {track.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {tiers.map(({ tier, price, sub }) => {
            const m = TIER_META[tier]; const Icon = m.icon;
            const owned = tierRank[unlockedTier] >= tierRank[tier];
            const locked = tier === "cristal" && !isFounder;
            return (
              <button
                key={tier}
                disabled={locked || paying === tier}
                onClick={() => onPick(tier)}
                className={`relative text-left p-4 rounded-xl text-white bg-gradient-to-br ${m.gradient}
                  hover:scale-[1.02] active:scale-100 transition-transform shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5" />
                  {owned && <span className="text-[10px] uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">Owned</span>}
                </div>
                <p className="font-display text-lg font-bold">{m.label}</p>
                <p className="text-xs opacity-80">{sub}</p>
                {price && <p className="text-sm mt-2 font-semibold">{price}</p>}
                {paying === tier && <Loader2 className="absolute top-3 right-3 w-4 h-4 animate-spin" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UpgradeDialog({
  open, onClose, track, standardGain, onUpgrade,
}: {
  open: boolean; onClose: () => void; track: Track; standardGain: number;
  onUpgrade: (kind: "tier_standard" | "tier_gold") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preview limit reached</DialogTitle>
          <DialogDescription>
            You've heard the free preview of "{track.title}".
            Unlock +{standardGain}% more with Standard, or the full track with Gold.
            Your spot is saved and resumes after payment.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onUpgrade("tier_standard")}>
            Standard · {formatZAR(track.price_standard_cents)}
          </Button>
          <Button className="bg-gradient-to-br from-amber-400 to-yellow-600 text-black" onClick={() => onUpgrade("tier_gold")}>
            <Crown className="w-4 h-4 mr-1" /> Gold · {formatZAR(track.price_gold_cents)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentReturnHandler({ onAccessChange }: { onAccessChange: () => void }) {
  const [params, setParams] = useSearchParams();
  const ref = params.get("ref");
  const pf = params.get("pf");
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState<{
    token: string; expiresAt: string; trackId: string;
    amountCents: number; paidAt: string | null; pfId: string | null; ref: string;
  } | null>(null);

  useEffect(() => {
    if (!ref || !pf) return;
    if (pf === "cancel") { toast.error("Payment cancelled"); cleanup(); return; }
    if (pf !== "return") return;
    setBusy(true);
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const res = await pollPaymentStatus(ref);
        if (res.status === "paid") {
          if (res.kind === "download" && res.download_token && res.download_expires_at) {
            setDownload({
              token: res.download_token,
              expiresAt: res.download_expires_at,
              trackId: res.track_id,
              amountCents: res.amount_cents,
              paidAt: res.paid_at,
              pfId: res.pf_payment_id,
              ref,
            });
            toast.success("Download ready");
          } else {
            const t = kindToTier(res.kind);
            if (t && res.track_id) {
              grantAccess(res.track_id, t, ref);
              onAccessChange();
              const trackId = res.track_id;
              toast.success(`${t === "gold" ? "Gold" : "Standard"} unlocked`, {
                action: { label: "Resume", onClick: () => {
                  const btn = document.querySelector<HTMLButtonElement>(`[data-track-play="${trackId}"]`);
                  btn?.scrollIntoView({ behavior: "smooth", block: "center" });
                  btn?.click();
                }},
              });
            }
          }
          cleanup(); return;
        }
        if (res.status === "failed" || res.status === "cancelled") {
          toast.error("Payment did not complete"); cleanup(); return;
        }
        if (tries < 20 && !cancelled) setTimeout(tick, 1500);
        else { toast("Payment still processing — refresh in a moment."); cleanup(); }
      } catch {
        if (tries < 5 && !cancelled) setTimeout(tick, 2000);
        else { toast.error("Could not verify payment"); cleanup(); }
      }
    };
    tick();
    return () => { cancelled = true; };
    function cleanup() {
      setBusy(false);
      const next = new URLSearchParams(params);
      next.delete("pf"); next.delete("ref");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, pf]);

  return (
    <>
      {busy && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border border-border rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
          <Loader2 className="animate-spin text-primary" />
          <div className="text-sm">Verifying payment…</div>
        </div>
      )}
      {download && (
        <DownloadConfirmation
          info={download}
          onClose={() => setDownload(null)}
        />
      )}
    </>
  );
}

function DownloadConfirmation({
  info, onClose,
}: {
  info: { token: string; expiresAt: string; trackId: string; amountCents: number; paidAt: string | null; pfId: string | null; ref: string };
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remainingMs = new Date(info.expiresAt).getTime() - now;
  const expired = remainingMs <= 0;
  const mins = Math.max(0, Math.floor(remainingMs / 60000));
  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-500" /> Download ready
          </DialogTitle>
          <DialogDescription>
            Payment confirmed. Your download link is single-use and expires shortly.
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs space-y-1.5 bg-secondary/40 border border-border rounded-md p-3 font-mono">
          <Row k="Receipt" v={info.ref} />
          {info.pfId && <Row k="PayFast ID" v={info.pfId} />}
          <Row k="Amount" v={formatZAR(info.amountCents)} />
          {info.paidAt && <Row k="Paid at" v={new Date(info.paidAt).toLocaleString()} />}
        </div>

        <div className={`rounded-md px-3 py-2 text-sm text-center tabular-nums ${expired ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
          {expired
            ? "Link expired — contact support to re-issue."
            : <>Link expires in <strong>{mins}:{secs.toString().padStart(2, "0")}</strong></>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            disabled={expired}
            onClick={() => {
              setStarted(true);
              window.open(downloadUrl(info.token), "_blank", "noopener");
            }}
            className="bg-gradient-to-br from-amber-400 to-yellow-600 text-black"
          >
            <Download className="w-4 h-4 mr-1" />
            {started ? "Download again" : "Start download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-all text-right">{v}</span>
    </div>
  );
}

function fmt(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
