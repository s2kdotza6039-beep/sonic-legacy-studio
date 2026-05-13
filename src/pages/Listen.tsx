import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Cloud, ArrowRight } from "lucide-react";
import { artists } from "@/data/artists";

interface NewSingle {
  artistId: string;
  artistName: string;
  title: string;
  cloudflareUrl: string;
}

const CLOUDFLARE_BASE = "https://newsingle.s2kdotza.com";

const newSingles: NewSingle[] = [
  {
    artistId: "pitch-black-afro",
    artistName: "Pitch Black Afro",
    title: "Kule Life",
    cloudflareUrl: `${CLOUDFLARE_BASE}/pitch-black-afro/kule-life`,
  },
  {
    artistId: "wijo-da-weekend",
    artistName: "WIJO da WEEKEND",
    title: "Shooting Star",
    cloudflareUrl: `${CLOUDFLARE_BASE}/wijo-da-weekend/shooting-star`,
  },
];

const SingleCard = ({ single }: { single: NewSingle }) => {
  const artist = artists.find((a) => a.id === single.artistId);
  const cover = artist?.image;

  return (
    <article className="group bg-card border border-border hover:border-primary/60 transition-all duration-500 flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {cover ? (
          <img
            src={cover}
            alt={`${single.title} by ${single.artistName}`}
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
          {single.artistName}
        </p>
        <h3 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">
          {single.title}
        </h3>

        <p className="text-xs text-muted-foreground italic mb-6">
          Available exclusively via Cloudflare Cloud
        </p>

        <div className="mt-auto space-y-3">
          <a
            href={single.cloudflareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gold-gradient text-primary-foreground px-6 py-4 text-xs uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-3"
          >
            <Cloud size={16} />
            Get "{single.title}" on Cloudflare Cloud
          </a>
          <Link
            to={`/artists/${single.artistId}`}
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

const Listen = () => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {newSingles.map((s) => (
            <SingleCard key={`${s.artistId}-${s.title}`} single={s} />
          ))}
        </div>

        <div className="mt-20 pt-10 border-t border-border text-center">
          <p className="text-sm text-muted-foreground italic">
            Albums and featured collaborations will be introduced in future release phases.
          </p>
        </div>
      </div>
    </section>
  </Layout>
);

export default Listen;
