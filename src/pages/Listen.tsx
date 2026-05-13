import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Cloud, ArrowRight } from "lucide-react";
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

const SingleCard = ({ release }: { release: Release }) => {
  const fallback = artists.find((a) => a.id === release.artist_id)?.image;
  const cover = release.cover_url || fallback;
  const href = buildCloudflareUrl(release);

  return (
    <article className="group bg-card border border-border hover:border-primary/60 transition-all duration-500 flex flex-col">
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
      </div>

      <div className="p-6 md:p-8 flex flex-col flex-1">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">
          {release.artist_name}
        </p>
        <h3 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">
          {release.title}
        </h3>

        <p className="text-xs text-muted-foreground italic mb-6">
          Available exclusively via Cloudflare Cloud
        </p>

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
              Latest official singles from the s2kDOTza Entertainment roster.
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading releases…</p>
          ) : releases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No new singles available yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              {releases.map((r) => (
                <SingleCard key={r.id} release={r} />
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
    </Layout>
  );
};

export default Listen;
