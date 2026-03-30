import { useState, useRef } from "react";
import { Play, Pause, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { Artist } from "@/data/artists";

const streamingIcons: Record<string, { label: string; color: string }> = {
  spotify: { label: "Spotify", color: "hover:text-[#1DB954]" },
  appleMusic: { label: "Apple Music", color: "hover:text-[#FA2D48]" },
  soundcloud: { label: "SoundCloud", color: "hover:text-[#FF5500]" },
  youtubeMusic: { label: "YouTube Music", color: "hover:text-[#FF0000]" },
};

function StreamingBadges({ streaming }: { streaming: Artist["streaming"] }) {
  const entries = Object.entries(streaming).filter(([, url]) => url);
  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, url]) => {
        const info = streamingIcons[key];
        if (!info) return null;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-border px-3 py-1.5 text-muted-foreground transition-colors ${info.color}`}
          >
            {info.label}
            <ExternalLink size={10} />
          </a>
        );
      })}
    </div>
  );
}

function TrackRow({ title, duration, audioUrl }: { title: string; duration: string; audioUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioUrl || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-4 border-b border-border py-3 group">
      {audioUrl ? (
        <>
          <button
            onClick={toggle}
            className="w-8 h-8 flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} preload="none" />
        </>
      ) : (
        <div className="w-8 h-8 flex items-center justify-center border border-border rounded-sm text-muted-foreground/40">
          <Play size={14} className="ml-0.5" />
        </div>
      )}
      <span className="flex-1 font-display text-sm">{title}</span>
      <span className="text-xs text-muted-foreground">{duration}</span>
    </div>
  );
}

interface ListenNowSectionProps {
  artists: Artist[];
  variant?: "full" | "compact";
  showHeading?: boolean;
}

export default function ListenNowSection({ artists, variant = "full", showHeading = true }: ListenNowSectionProps) {
  const filtered = artists.filter((a) => a.tracks.length > 0 || Object.values(a.streaming).some(Boolean));
  if (!filtered.length) return null;

  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto">
        {showHeading && (
          <div className="mb-12">
            <p className="text-sm uppercase tracking-widest text-primary mb-2">Listen Now</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">Stream & Play</h2>
          </div>
        )}

        <div className={variant === "full" ? "grid grid-cols-1 md:grid-cols-2 gap-12" : "space-y-10"}>
          {filtered.map((artist) => (
            <div key={artist.id} className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 overflow-hidden border border-border">
                  <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <Link to={`/artists/${artist.id}`} className="font-display font-semibold hover:text-primary transition-colors">
                    {artist.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{artist.genre}</p>
                </div>
              </div>

              {artist.tracks.length > 0 && (
                <div>
                  {artist.tracks.map((track) => (
                    <TrackRow key={track.title} {...track} />
                  ))}
                </div>
              )}

              <StreamingBadges streaming={artist.streaming} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ArtistListenSection({ artist }: { artist: Artist }) {
  const hasContent = artist.tracks.length > 0 || Object.values(artist.streaming).some(Boolean);
  if (!hasContent) return null;

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-6 text-gold-gradient inline-block">Listen Now</h2>
      {artist.tracks.length > 0 && (
        <div className="mb-6">
          {artist.tracks.map((track) => (
            <TrackRow key={track.title} {...track} />
          ))}
        </div>
      )}
      <StreamingBadges streaming={artist.streaming} />
    </div>
  );
}
