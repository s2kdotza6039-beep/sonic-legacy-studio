import { describe, it, expect } from "vitest";
import { buildCloudflareUrl } from "@/lib/releaseUrl";

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
      const url = buildCloudflareUrl(release);
      expect(url).toBe(release.cloudflare_url);
      expect(url.startsWith("https://newsingle.s2kdotza.com/")).toBe(true);
    },
  );

  it("falls back to a slugified URL when cloudflare_url is missing", () => {
    expect(
      buildCloudflareUrl({
        artist_id: "pitch-black-afro",
        artist_name: "Pitch Black Afro",
        title: "Kule Life",
        cloudflare_url: null,
      }),
    ).toBe("https://newsingle.s2kdotza.com/pitch-black-afro/kule-life");

    expect(
      buildCloudflareUrl({
        artist_id: "",
        artist_name: "WIJO da WEEKEND",
        title: "Shooting Star",
        cloudflare_url: "  ",
      }),
    ).toBe("https://newsingle.s2kdotza.com/wijo-da-weekend/shooting-star");
  });
});
