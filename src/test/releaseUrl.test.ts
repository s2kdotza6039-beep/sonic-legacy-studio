import { describe, it, expect } from "vitest";
import { buildCloudflareUrl, resolveCloudflareUrl } from "@/lib/releaseUrl";

// Mirrors the seeded rows in
// supabase/migrations/20260513034753_*.sql for public.releases
const SEEDED_RELEASES = [
  {
    artist_id: "pitch-black-afro",
    artist_name: "Pitch Black Afro",
    title: "Kule Life",
    cloudflare_url: "https://newsingle.s2kdotza.com/pitch-black-afro/kule-life",
  },
  {
    artist_id: "wijo-da-weekend",
    artist_name: "WIJO da WEEKEND",
    title: "Shooting Star",
    cloudflare_url: "https://newsingle.s2kdotza.com/wijo-da-weekend/shooting-star",
  },
] as const;

describe("New Singles card destinations", () => {
  it.each(SEEDED_RELEASES)(
    "$artist_name — $title resolves to the expected newsingle.s2kdotza.com URL",
    (release) => {
      const result = resolveCloudflareUrl(release);
      expect(result.url).toBe(release.cloudflare_url);
      expect(result.reason).toBe("explicit");
    },
  );

  it("derives a slugified URL when cloudflare_url is missing", () => {
    expect(
      buildCloudflareUrl({
        artist_id: "pitch-black-afro",
        artist_name: "Pitch Black Afro",
        title: "Kule Life",
        cloudflare_url: null,
      }),
    ).toBe("https://newsingle.s2kdotza.com/pitch-black-afro/kule-life");

    const r = resolveCloudflareUrl({
      artist_id: "",
      artist_name: "WIJO da WEEKEND",
      title: "Shooting Star",
      cloudflare_url: "  ",
    });
    expect(r.url).toBe("https://newsingle.s2kdotza.com/wijo-da-weekend/shooting-star");
    expect(r.reason).toBe("derived");
  });
});

describe("resolveCloudflareUrl fallbacks", () => {
  it("returns missing-title when title is absent", () => {
    expect(
      resolveCloudflareUrl({ artist_id: "pba", artist_name: "PBA", title: "" }),
    ).toEqual({ url: null, reason: "missing-title" });
    expect(
      resolveCloudflareUrl({ artist_id: "pba", artist_name: "PBA", title: "   " }),
    ).toEqual({ url: null, reason: "missing-title" });
    expect(
      resolveCloudflareUrl({ artist_id: "pba", artist_name: "PBA", title: "!!!" }),
    ).toEqual({ url: null, reason: "missing-title" });
  });

  it("returns missing-artist when artist_id and artist_name are absent", () => {
    expect(
      resolveCloudflareUrl({ artist_id: null, artist_name: null, title: "Kule Life" }),
    ).toEqual({ url: null, reason: "missing-artist" });
    expect(
      resolveCloudflareUrl({ artist_id: "  ", artist_name: "  ", title: "Kule Life" }),
    ).toEqual({ url: null, reason: "missing-artist" });
  });

  it("falls back to artist_name when artist_id is missing", () => {
    const r = resolveCloudflareUrl({
      artist_id: null,
      artist_name: "Pitch Black Afro",
      title: "Kule Life",
    });
    expect(r.url).toBe("https://newsingle.s2kdotza.com/pitch-black-afro/kule-life");
    expect(r.reason).toBe("derived");
  });

  it("rejects an invalid stored cloudflare_url", () => {
    expect(
      resolveCloudflareUrl({
        artist_id: "pba",
        artist_name: "PBA",
        title: "Kule Life",
        cloudflare_url: "not a url",
      }),
    ).toEqual({ url: null, reason: "invalid-url" });
  });

  it("buildCloudflareUrl returns null when URL is unbuildable", () => {
    expect(buildCloudflareUrl({ artist_name: "", title: "" })).toBeNull();
  });
});
