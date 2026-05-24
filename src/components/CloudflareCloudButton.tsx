import { Cloud, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveCloudflareUrl, type ReleaseUrlInput } from "@/lib/releaseUrl";
import { toast } from "sonner";

export interface CloudflareCloudButtonProps {
  release: ReleaseUrlInput & {
    id?: string | null;
    title?: string | null;
    artist_name?: string | null;
  };
  /** Where the click is happening (e.g. "home", "releases-admin", "artist-page"). */
  source: string;
  className?: string;
  label?: string;
  compact?: boolean;
}

/**
 * Outbound link to a release on Cloudflare Cloud (newsingle.s2kdotza.com).
 * Records every click in `release_clicks` for founder analytics.
 */
export async function logReleaseClick(
  release: CloudflareCloudButtonProps["release"],
  source: string,
  destinationUrl: string,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("release_clicks").insert({
      release_id: release.id ?? null,
      release_title: release.title ?? null,
      artist_name: release.artist_name ?? null,
      destination_url: destinationUrl,
      source,
      user_id: user?.id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  } catch (e) {
    // Tracking must never block navigation.
    console.warn("release click log failed", e);
  }
}

export default function CloudflareCloudButton({
  release,
  source,
  className,
  label = "Get on Cloudflare Cloud",
  compact = false,
}: CloudflareCloudButtonProps) {
  const { url, reason } = resolveCloudflareUrl(release);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!url) {
      e.preventDefault();
      toast.error("Cloud link unavailable", {
        description: `Reason: ${reason}. Set a Cloudflare URL on the release.`,
      });
      return;
    }
    // Fire and forget — don't await so the new tab opens immediately.
    void logReleaseClick(release, source, url);
  };

  const base = compact
    ? "inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-border px-3 py-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
    : "inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity";

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => handleClick({ preventDefault: () => {} } as React.MouseEvent<HTMLAnchorElement>)}
        className={`${base} opacity-60 ${className ?? ""}`}
        title={`Missing Cloudflare URL (${reason})`}
      >
        <Cloud size={compact ? 12 : 16} /> {label}
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`${base} ${className ?? ""}`}
      data-source={source}
    >
      <Cloud size={compact ? 12 : 16} />
      {label}
      <ExternalLink size={compact ? 10 : 12} />
    </a>
  );
}
