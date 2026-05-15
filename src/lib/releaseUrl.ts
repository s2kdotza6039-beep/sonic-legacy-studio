export interface ReleaseUrlInput {
  artist_id?: string | null;
  artist_name?: string | null;
  title?: string | null;
  cloudflare_url?: string | null;
}

export const CLOUDFLARE_BASE = "https://newsingle.s2kdotza.com";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isValidHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export type CloudflareUrlReason =
  | "explicit"
  | "derived"
  | "missing-title"
  | "missing-artist"
  | "invalid-url";

export interface CloudflareUrlResult {
  url: string | null;
  reason: CloudflareUrlReason;
}

/**
 * Resolve a release's Cloudflare destination.
 * Returns `{ url: null, reason }` when the link cannot be safely built —
 * callers should render a fallback UI instead of a broken link.
 */
export const resolveCloudflareUrl = (release: ReleaseUrlInput): CloudflareUrlResult => {
  const explicit = release.cloudflare_url?.trim();
  if (explicit) {
    return isValidHttpUrl(explicit)
      ? { url: explicit, reason: "explicit" }
      : { url: null, reason: "invalid-url" };
  }

  const title = release.title?.trim();
  if (!title) return { url: null, reason: "missing-title" };

  const artistSeed = release.artist_id?.trim() || release.artist_name?.trim();
  if (!artistSeed) return { url: null, reason: "missing-artist" };

  const artistSlug = slugify(artistSeed);
  const titleSlug = slugify(title);
  if (!artistSlug) return { url: null, reason: "missing-artist" };
  if (!titleSlug) return { url: null, reason: "missing-title" };

  return {
    url: `${CLOUDFLARE_BASE}/${artistSlug}/${titleSlug}`,
    reason: "derived",
  };
};

/** Backwards-compatible helper: returns the URL string or `null` if unbuildable. */
export const buildCloudflareUrl = (release: ReleaseUrlInput): string | null =>
  resolveCloudflareUrl(release).url;
