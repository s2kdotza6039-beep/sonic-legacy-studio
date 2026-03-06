import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { artists } from "@/data/artists";

const Artists = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">The Roster</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Our Artists</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          A curated roster of extraordinary talent. Each artist represents the future of their genre.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {artists.map((artist) => (
          <Link key={artist.id} to={`/artists/${artist.id}`} className="group">
            <div className="aspect-[3/4] overflow-hidden mb-4">
              <img src={artist.image} alt={artist.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105" />
            </div>
            <h3 className="font-display text-xl font-semibold">{artist.name}</h3>
            <p className="text-sm text-primary mb-1">{artist.genre}</p>
            <p className="text-sm text-muted-foreground">{artist.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  </Layout>
);

export default Artists;
