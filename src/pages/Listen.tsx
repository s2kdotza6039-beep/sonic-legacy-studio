import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Cloud, ArrowRight, Play, Pause, Loader2, AlertCircle, SkipForward } from "lucide-react";
import { artists } from "@/data/artists";
import { supabase } from "@/integrations/supabase/client";

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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("releases")
        .select("id, artist_id, artist_name, title, cover_url, cloudflare_url, is_featured, sort_order")
        .eq("release_type", "Single")
        .eq("status", "New Single")
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true });

      if (!error && data) setReleases(data as Release[]);
      setLoading(false);
    })();
  }, []);

  const currentIndex = currentId ? releases.findIndex((r) => r.id === currentId) : -1;
  const currentRelease = currentIndex >= 0 ? releases[currentIndex] : null;

  const playRelease = (release: Release) => {
    if (currentId === release.id && audioRef.current) {
      audioRef.current.play().catch(() => setStatus("error"));
      return;
    }
    setCurrentId(release.id);
    setStatus("loading");
  };

  // When currentId changes, load and play the new track
  useEffect(() => {
    if (!currentRelease || !audioRef.current) return;
    const audio = audioRef.current;
    audio.src = buildCloudflareUrl(currentRelease);
    audio.load();
    audio.play().catch(() => setStatus("error"));
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePause = () => {
    audioRef.current?.pause();
  };

  const handleRetry = () => {
    if (!currentRelease || !audioRef.current) return;
    setStatus("loading");
    audioRef.current.load();
    audioRef.current.play().catch(() => setStatus("error"));
  };

  // Slow-stream timeout: if loading persists, surface a "taking too long" UI
  useEffect(() => {
    if (status !== "loading") return;
    const t = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "slow" : s));
    }, SLOW_THRESHOLD_MS);
    return () => window.clearTimeout(t);
  }, [status, currentId]);

  const playNext = () => {
    if (currentIndex < 0 || currentIndex >= releases.length - 1) {
      setStatus("idle");
      setCurrentId(null);
      return;
    }
    playRelease(releases[currentIndex + 1]);
  };

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

      {/* Persistent player bar */}
      {currentRelease && (
        <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
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
              {status === "loading" && (
                <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
              )}
              {status === "error" && (
                <span className="inline-flex items-center gap-1 text-xs text-destructive flex-shrink-0">
                  <AlertCircle size={12} /> Stream failed
                </span>
              )}
            </div>

            <audio
              ref={audioRef}
              controls
              preload="none"
              className="flex-1 min-w-[200px] max-w-md"
              onLoadStart={() => setStatus("loading")}
              onCanPlay={() => setStatus((s) => (s === "loading" ? "paused" : s))}
              onWaiting={() => setStatus("loading")}
              onPlaying={() => setStatus("playing")}
              onPause={() => setStatus((s) => (s === "playing" ? "paused" : s))}
              onError={() => setStatus("error")}
              onEnded={playNext}
            >
              Your browser does not support the audio element.
            </audio>

            <button
              onClick={playNext}
              disabled={currentIndex < 0 || currentIndex >= releases.length - 1}
              className="border border-border hover:border-primary text-foreground px-3 py-2 text-xs uppercase tracking-widest font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Play next single"
            >
              <SkipForward size={14} /> Next
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Listen;
