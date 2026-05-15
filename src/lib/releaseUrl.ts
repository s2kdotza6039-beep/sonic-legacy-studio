export interface ReleaseUrlInput {
  artist_id?: string | null;
  artist_name: string;
  title: string;
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

export const buildCloudflareUrl = (release: ReleaseUrlInput) =>
  release.cloudflare_url?.trim()
    ? release.cloudflare_url.trim()
    : `${CLOUDFLARE_BASE}/${slugify(release.artist_id || release.artist_name)}/${slugify(release.title)}`;
