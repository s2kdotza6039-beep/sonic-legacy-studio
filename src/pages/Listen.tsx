import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Cloud, ArrowRight, Play, Pause, Loader2, AlertCircle, SkipForward, Terminal, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { artists } from "@/data/artists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Release {
  id: string;
  artist_id: string;
  artist_name: string;
  title: string;
  cover_url: string | null;
  cloudflare_url: string | null;
}

type PlayerStatus = "idle" | "loading" | "slow" | "playing" | "paused" | "error";

const SLOW_THRESHOLD_MS = 8000;
const STORAGE_KEY = "listen:currentId";
const STATUS_STORAGE_KEY = "listen:lastStatus";
const BACKOFF_BASE_MS = 1500;
const BACKOFF_MAX_MS = 30000;

const CLOUDFLARE_BASE = "https://newsingle.s2kdotza.com";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildCloudflareUrl = (release: Release) =>
  release.cloudflare_url?.trim()
    ? release.cloudflare_url
    : `${CLOUDFLARE_BASE}/${slugify(release.artist_id || release.artist_name)}/${slugify(release.title)}`;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface DiagEntry {
  ts: number;
  trackId: string;
  trackTitle: string;
  event: string;
  detail?: string;
}

interface CardProps {
  release: Release;
  isActive: boolean;
  status: PlayerStatus;
  onPlay: () => void;
  onPause: () => void;
  onRetry: () => void;
}

const SingleCard = ({ release, isActive, status, onPlay, onPause, onRetry }: CardProps) => {
  const fallback = artists.find((a) => a.id === release.artist_id)?.image;
  const cover = release.cover_url || fallback;
  const href = buildCloudflareUrl(release);

  const isLoading = isActive && status === "loading";
  const isPlaying = isActive && status === "playing";
  const isError = isActive && status === "error";
  const isSlow = isActive && status === "slow";

  return (
    <article
      className={`group bg-card border transition-all duration-500 flex flex-col ${
        isActive ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border hover:border-primary/60"
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {cover ? (
          <img
            src={cover}
            alt={`${release.title} by ${release.artist_name}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 font-display text-sm">
            Cover Artwork
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className="bg-gold-gradient text-primary-foreground text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1.5">
            New Single
          </span>
        </div>
        {isActive && (
          <div className="absolute top-4 right-4">
            <span className="bg-background/80 backdrop-blur-sm border border-primary text-primary text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1.5 inline-flex items-center gap-1.5">
              {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
              {isPlaying ? "Now Playing" : isLoading ? "Loading" : isSlow ? "Slow" : isError ? "Error" : "Selected"}
            </span>
          </div>
        )}
      </div>

      <div className="p-6 md:p-8 flex flex-col flex-1">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">
          {release.artist_name}
        </p>
        <h3 className="text-2xl md:text-3xl font-display font-bold mb-4 text-gold-gradient inline-block">
          {release.title}
        </h3>

        <p className="text-xs text-muted-foreground italic mb-4">
          Available exclusively via Cloudflare Cloud
        </p>

        <button
          onClick={isPlaying ? onPause : (isError || isSlow) ? onRetry : onPlay}
          disabled={isLoading}
          className="w-full border border-border hover:border-primary text-foreground px-4 py-3 text-xs uppercase tracking-widest font-medium transition-colors inline-flex items-center justify-center gap-2 mb-6 disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Buffering…
            </>
          ) : isPlaying ? (
            <>
              <Pause size={14} /> Pause Preview
            </>
          ) : isSlow ? (
            <>
              <AlertCircle size={14} className="text-primary" /> Retry Stream
            </>
          ) : isError ? (
            <>
              <AlertCircle size={14} className="text-destructive" /> Retry Stream
            </>
          ) : (
            <>
              <Play size={14} /> Play Preview
            </>
          )}
        </button>

        {isSlow && (
          <div className="border border-primary/40 bg-primary/5 px-4 py-3 mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Stream is taking too long
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Cloudflare preview is slow to load. You can keep waiting, retry, or
              download the full track below.
            </p>
          </div>
        )}

        {isError && (
          <p className="text-xs text-destructive mb-4 leading-relaxed">
            Unable to load the Cloudflare stream. Check your connection and try again, or
            download the full track below.
          </p>
        )}

        <div className="mt-auto space-y-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gold-gradient text-primary-foreground px-6 py-4 text-xs uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-3"
          >
            <Cloud size={16} />
            Get "{release.title}" on Cloudflare Cloud
          </a>
          <Link
            to={`/artists/${release.artist_id}`}
            className="w-full border border-border hover:border-primary text-foreground px-6 py-3 text-xs uppercase tracking-widest font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            View Artist Profile
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
};

const Listen = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [autoplayOnLoad, setAutoplayOnLoad] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>(() => {
    if (typeof window === "undefined") return "idle";
    const persisted = window.localStorage.getItem(STATUS_STORAGE_KEY);
    return persisted === "error" || persisted === "slow" ? (persisted as PlayerStatus) : "idle";
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Backoff + diagnostics
  const [retryCount, setRetryCount] = useState(0);
  const [retryCooldownUntil, setRetryCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagEntry[]>([]);
  const loadStartRef = useRef<number | null>(null);
  const lastToastStatusRef = useRef<PlayerStatus | null>(null);

  const logDiag = (event: string, detail?: string) => {
    const release = currentReleaseRef.current;
    setDiagnostics((d) =>
      [
        ...d,
        {
          ts: Date.now(),
          trackId: release?.id ?? "—",
          trackTitle: release?.title ?? "—",
          event,
          detail,
        },
      ].slice(-100),
    );
  };

  // Persist last error/slow status only
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "error" || status === "slow") {
      window.localStorage.setItem(STATUS_STORAGE_KEY, status);
    } else {
      window.localStorage.removeItem(STATUS_STORAGE_KEY);
    }
  }, [status]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("releases")
        .select("id, artist_id, artist_name, title, cover_url, cloudflare_url, is_featured, sort_order")
        .eq("release_type", "Single")
        .eq("status", "New Single")
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const list = data as Release[];
        setReleases(list);
        if (currentId && !list.some((r) => r.id === currentId)) {
          setCurrentId(null);
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(STATUS_STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentId) window.localStorage.setItem(STORAGE_KEY, currentId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [currentId]);

  const currentIndex = currentId ? releases.findIndex((r) => r.id === currentId) : -1;
  const currentRelease = currentIndex >= 0 ? releases[currentIndex] : null;
  const currentReleaseRef = useRef<Release | null>(null);
  useEffect(() => {
    currentReleaseRef.current = currentRelease;
  }, [currentRelease]);

  // Tick for cooldown countdown
  useEffect(() => {
    if (retryCooldownUntil <= Date.now()) return;
    const i = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(i);
  }, [retryCooldownUntil]);

  const cooldownRemaining = Math.max(0, retryCooldownUntil - now);
  const canRetry = cooldownRemaining === 0;

  const playRelease = (release: Release) => {
    if (currentId === release.id && audioRef.current) {
      audioRef.current.play().catch(() => setStatus("error"));
      return;
    }
    setRetryCount(0);
    setRetryCooldownUntil(0);
    setAutoplayOnLoad(true);
    setCurrentId(release.id);
    setStatus("loading");
    setCurrentTime(0);
    setDuration(0);
    logDiag("track:select", release.title);
  };

  useEffect(() => {
    if (!currentRelease || !audioRef.current) return;
    const audio = audioRef.current;
    audio.src = buildCloudflareUrl(currentRelease);
    audio.load();
    if (autoplayOnLoad) {
      audio.play().catch(() => setStatus("error"));
    } else {
      setStatus((s) => (s === "error" || s === "slow" ? s : "paused"));
    }
  }, [currentId, currentRelease?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = () => {
    if (!audioRef.current) return;
    audioRef.current.play().catch(() => setStatus("error"));
  };

  const handlePause = () => {
    audioRef.current?.pause();
  };

  const handleRetry = () => {
    if (!currentRelease || !audioRef.current) return;
    if (!canRetry) {
      toast.info(`Please wait ${Math.ceil(cooldownRemaining / 1000)}s before retrying`);
      return;
    }
    const nextCount = retryCount + 1;
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, retryCount), BACKOFF_MAX_MS);
    setRetryCount(nextCount);
    setRetryCooldownUntil(Date.now() + delay);
    setStatus("loading");
    audioRef.current.load();
    audioRef.current.play().catch(() => setStatus("error"));
    logDiag("retry", `attempt ${nextCount}, next cooldown ${delay}ms`);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const t = value[0];
    setCurrentTime(t);
    audioRef.current.currentTime = t;
  };

  // Slow-stream timeout
  useEffect(() => {
    if (status !== "loading") return;
    const startedAt = Date.now();
    const t = window.setTimeout(() => {
      setStatus((s) => {
        if (s === "loading") {
          const elapsed = Date.now() - startedAt;
          logDiag("status:slow", `after ${elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`);
          return "slow";
        }
        return s;
      });
    }, SLOW_THRESHOLD_MS);
    return () => window.clearTimeout(t);
  }, [status, currentId]);

  // Toast on slow / error transitions
  useEffect(() => {
    if (status !== "slow" && status !== "error") {
      lastToastStatusRef.current = null;
      return;
    }
    if (lastToastStatusRef.current === status) return;
    lastToastStatusRef.current = status;
    const title = currentRelease?.title ?? "Stream";
    if (status === "slow") {
      toast.warning(`Stream is slow — "${title}"`, {
        description: "Cloudflare is taking a while to respond.",
        action: { label: "Retry", onClick: () => handleRetry() },
      });
    } else {
      toast.error(`Stream failed — "${title}"`, {
        description: "Unable to load the Cloudflare audio.",
        action: { label: "Retry", onClick: () => handleRetry() },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentRelease?.id]);

  const playNext = () => {
    if (currentIndex < 0 || currentIndex >= releases.length - 1) {
      setStatus("idle");
      setCurrentId(null);
      return;
    }
    playRelease(releases[currentIndex + 1]);
  };

  const isPlayingNow = status === "playing";
  const seekMax = duration > 0 ? duration : 0;

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Audio Experience</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Listen Now</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Access the latest official singles from s2kDOTza Entertainment. Initial releases are
            available directly through Cloudflare Cloud.
          </p>
        </div>
      </div>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-16">
            <p className="text-sm uppercase tracking-widest text-primary mb-2">Now Available</p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">New Singles</h2>
            <p className="text-muted-foreground max-w-2xl">
              Latest official singles from the s2kDOTza Entertainment roster. Tracks queue
              automatically — when one finishes, the next featured single plays.
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading releases…</p>
          ) : releases.length === 0 ? (
            <div className="border border-border bg-card/50 px-8 py-16 md:py-20 text-center">
              <div className="max-w-md mx-auto">
                <Cloud className="mx-auto mb-6 text-primary/60" size={36} />
                <p className="text-xs uppercase tracking-[0.25em] text-primary mb-3">
                  No featured singles
                </p>
                <h3 className="text-2xl md:text-3xl font-display font-bold mb-4">
                  New music coming soon
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  There are no featured singles available right now. Check back shortly for the
                  next official release from the s2kDOTza Entertainment roster.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              {releases.map((r) => (
                <SingleCard
                  key={r.id}
                  release={r}
                  isActive={currentId === r.id}
                  status={currentId === r.id ? status : "idle"}
                  onPlay={() => playRelease(r)}
                  onPause={handlePause}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}

          <div className="mt-20 pt-10 border-t border-border text-center">
            <p className="text-sm text-muted-foreground italic">
              Albums and featured collaborations will be introduced in future release phases.
            </p>
          </div>
        </div>
      </section>

      {/* Diagnostics console panel */}
      <div className="fixed bottom-24 right-4 z-50">
        {diagOpen ? (
          <div className="w-[min(92vw,420px)] max-h-[50vh] flex flex-col bg-background border border-border shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary inline-flex items-center gap-2">
                <Terminal size={12} /> Playback Diagnostics
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDiagnostics([])}
                  className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  onClick={() => setDiagOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close diagnostics"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="px-3 py-2 border-b border-border text-[11px] text-muted-foreground space-y-1">
              <div>Status: <span className="text-foreground">{status}</span></div>
              <div>Slow threshold: {SLOW_THRESHOLD_MS}ms</div>
              <div>
                Retries: <span className="text-foreground">{retryCount}</span>
                {cooldownRemaining > 0 && (
                  <> · Cooldown: <span className="text-foreground">{Math.ceil(cooldownRemaining / 1000)}s</span></>
                )}
              </div>
              <div>Duration: {formatTime(duration)} · Time: {formatTime(currentTime)}</div>
            </div>
            <div className="overflow-y-auto flex-1 font-mono text-[11px] p-2 space-y-1">
              {diagnostics.length === 0 ? (
                <p className="text-muted-foreground italic px-1">No events yet.</p>
              ) : (
                [...diagnostics].reverse().map((d, i) => (
                  <div key={i} className="border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">
                      {new Date(d.ts).toLocaleTimeString()}
                    </span>{" "}
                    <span className="text-primary">{d.event}</span>
                    {d.detail && <span className="text-foreground"> — {d.detail}</span>}
                    <div className="text-muted-foreground/70 truncate">{d.trackTitle}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDiagOpen(true)}
            className="bg-card border border-border hover:border-primary px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2 shadow-lg"
            title="Open playback diagnostics"
          >
            <Terminal size={12} /> Diagnostics
            {diagnostics.length > 0 && (
              <span className="text-primary">({diagnostics.length})</span>
            )}
          </button>
        )}
      </div>

      {/* Persistent player bar */}
      {currentRelease && (
        <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-3 md:gap-4 flex-wrap md:flex-nowrap">
              {/* Track info */}
              <div className="flex items-center gap-3 min-w-0 md:w-64 flex-shrink-0">
                {currentRelease.cover_url && (
                  <img
                    src={currentRelease.cover_url}
                    alt=""
                    className="w-12 h-12 object-cover border border-border flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground truncate">
                    {currentRelease.artist_name}
                  </p>
                  <p className="font-display font-semibold text-sm truncate">
                    {currentRelease.title}
                  </p>
                </div>
              </div>

              {/* Transport + progress */}
              <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                <button
                  onClick={isPlayingNow ? handlePause : (status === "error" || status === "slow") ? handleRetry : handlePlay}
                  disabled={status === "loading" || ((status === "error" || status === "slow") && !canRetry)}
                  className="w-10 h-10 rounded-full bg-gold-gradient text-primary-foreground inline-flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
                  title={isPlayingNow ? "Pause" : (status === "error" || status === "slow") && !canRetry ? `Retry in ${Math.ceil(cooldownRemaining / 1000)}s` : "Play"}
                >
                  {status === "loading" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isPlayingNow ? (
                    <Pause size={16} />
                  ) : (status === "error" || status === "slow") ? (
                    <AlertCircle size={16} />
                  ) : (
                    <Play size={16} className="ml-0.5" />
                  )}
                </button>

                <button
                  onClick={playNext}
                  disabled={currentIndex < 0 || currentIndex >= releases.length - 1}
                  className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  title="Play next single"
                >
                  <SkipForward size={18} />
                </button>

                <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right flex-shrink-0">
                  {formatTime(currentTime)}
                </span>

                <Slider
                  value={[Math.min(currentTime, seekMax)]}
                  max={seekMax || 1}
                  step={0.1}
                  disabled={!duration}
                  onValueChange={(v) => {
                    setSeeking(true);
                    setCurrentTime(v[0]);
                  }}
                  onValueCommit={(v) => {
                    handleSeek(v);
                    setSeeking(false);
                  }}
                  className="flex-1"
                />

                <span className="text-[11px] tabular-nums text-muted-foreground w-10 flex-shrink-0">
                  {formatTime(duration)}
                </span>

                {status === "slow" && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-primary border border-primary/40 px-2 py-1 flex-shrink-0">
                    <AlertCircle size={12} /> Slow{cooldownRemaining > 0 && ` ${Math.ceil(cooldownRemaining / 1000)}s`}
                  </span>
                )}
                {status === "error" && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-destructive border border-destructive/40 px-2 py-1 flex-shrink-0">
                    <AlertCircle size={12} /> Error{cooldownRemaining > 0 && ` ${Math.ceil(cooldownRemaining / 1000)}s`}
                  </span>
                )}
              </div>
            </div>

            <audio
              ref={audioRef}
              preload="metadata"
              className="hidden"
              onLoadStart={() => {
                loadStartRef.current = Date.now();
                logDiag("audio:loadstart");
                setStatus((s) => (s === "error" || s === "slow" ? s : "loading"));
              }}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration || 0;
                setDuration(d);
                logDiag("audio:loadedmetadata", `duration ${formatTime(d)}`);
              }}
              onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => {
                if (!seeking) setCurrentTime(e.currentTarget.currentTime);
              }}
              onCanPlay={() => {
                const took = loadStartRef.current ? Date.now() - loadStartRef.current : null;
                logDiag("audio:canplay", took !== null ? `loaded in ${took}ms` : undefined);
                setStatus((s) => (s === "loading" || s === "slow" ? "paused" : s));
              }}
              onWaiting={() => {
                logDiag("audio:waiting", "buffer underrun");
                setStatus((s) => (s === "playing" ? "loading" : s));
              }}
              onPlaying={() => {
                logDiag("audio:playing");
                setStatus("playing");
                setRetryCount(0);
                setRetryCooldownUntil(0);
              }}
              onPause={() => {
                logDiag("audio:pause");
                setStatus((s) => (s === "playing" ? "paused" : s));
              }}
              onError={(e) => {
                const err = (e.currentTarget as HTMLAudioElement).error;
                const codeMap: Record<number, string> = {
                  1: "MEDIA_ERR_ABORTED",
                  2: "MEDIA_ERR_NETWORK",
                  3: "MEDIA_ERR_DECODE",
                  4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
                };
                const detail = err ? `${codeMap[err.code] ?? `code ${err.code}`}${err.message ? ` — ${err.message}` : ""}` : "unknown";
                logDiag("audio:error", detail);
                setStatus("error");
              }}
              onEnded={() => {
                logDiag("audio:ended");
                playNext();
              }}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Listen;
