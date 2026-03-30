import Layout from "@/components/Layout";
import { artists } from "@/data/artists";
import { Play, ExternalLink } from "lucide-react";
import ListenNowSection from "@/components/ListenNow";

const YOUTUBE_CHANNEL = "https://youtube.com/@therealpitchblackafro?si=oXXv9tzK3IjkBiIh";

const Watch = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Visual Experience</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Watch Now</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Music videos, live performances, and behind-the-scenes content from the s2kDOTza roster.
        </p>
        <a
          href={YOUTUBE_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gold-gradient text-primary-foreground px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-3"
        >
          <Play size={18} />
          Subscribe on YouTube
          <ExternalLink size={14} />
        </a>
      </div>
    </div>

    {/* Featured Video */}
    <div className="section-padding max-w-6xl mx-auto">
      <h2 className="text-2xl font-display font-bold mb-8 text-gold-gradient inline-block">
        Featured
      </h2>
      <div className="aspect-video w-full overflow-hidden border border-border bg-secondary">
        <iframe
          src="https://www.youtube.com/embed?listType=user_uploads&list=therealpitchblackafro"
          title="s2kDOTza Entertainment - YouTube"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>

    {/* Artist Videos Grid */}
    <div className="section-padding max-w-7xl mx-auto">
      <h2 className="text-2xl font-display font-bold mb-8 text-gold-gradient inline-block">
        From the Roster
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {artists.map((artist) => (
          <a
            key={artist.id}
            href={YOUTUBE_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <div className="aspect-video overflow-hidden mb-4 relative border border-border">
              <img
                src={artist.image}
                alt={artist.name}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 rounded-full bg-gold-gradient flex items-center justify-center">
                  <Play size={24} className="text-primary-foreground ml-1" />
                </div>
              </div>
            </div>
            <h3 className="font-display text-lg font-semibold">{artist.name}</h3>
            <p className="text-sm text-muted-foreground">{artist.genre}</p>
          </a>
        ))}
      </div>
    </div>

    {/* YouTube CTA */}
    <div className="section-padding text-center border-t border-border">
      <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
        Don't Miss a <span className="text-gold-gradient">Beat</span>
      </h2>
      <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
        Subscribe to our YouTube channel for the latest music videos, live sessions, and exclusive content.
      </p>
      <a
        href={YOUTUBE_CHANNEL}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-gold-gradient text-primary-foreground px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-3"
      >
        Visit Our Channel
        <ExternalLink size={16} />
      </a>
    </div>
  </Layout>
);

export default Watch;
