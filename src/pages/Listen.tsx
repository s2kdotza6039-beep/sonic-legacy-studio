import Layout from "@/components/Layout";
import { artists } from "@/data/artists";
import ListenNowSection from "@/components/ListenNow";
import { Headphones, ExternalLink } from "lucide-react";

const Listen = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Audio Experience</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Listen Now</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Stream the latest tracks from our roster or play select previews directly on the site.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://open.spotify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gold-gradient text-primary-foreground px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-3"
          >
            <Headphones size={18} />
            Open on Spotify
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>

    <ListenNowSection artists={artists} showHeading={false} />
  </Layout>
);

export default Listen;
