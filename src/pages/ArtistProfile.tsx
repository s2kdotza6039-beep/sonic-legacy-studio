import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { artists } from "@/data/artists";
import { ArrowLeft } from "lucide-react";
import { ArtistListenSection } from "@/components/ListenNow";

const ArtistProfile = () => {
  const { id } = useParams();
  const artist = artists.find((a) => a.id === id);

  if (!artist) {
    return (
      <Layout>
        <div className="page-hero text-center">
          <h1 className="text-4xl font-display font-bold">Artist Not Found</h1>
          <Link to="/artists" className="text-primary mt-4 inline-block">Back to Artists</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <div className="relative min-h-[60vh] flex items-end">
        <div className="absolute inset-0">
          <img src={artist.image} alt={artist.name} className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <div className="relative z-10 page-hero w-full">
          <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Artists
          </Link>
          <p className="text-sm uppercase tracking-widest text-primary mb-2">{artist.genre}</p>
          <h1 className="text-5xl md:text-7xl font-display font-bold">{artist.name}</h1>
          <p className="text-xl text-muted-foreground mt-2">{artist.tagline}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto section-padding space-y-20">
        {/* Bio */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-4 text-gold-gradient inline-block">Biography</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">{artist.bio}</p>
        </div>

        {/* Discography */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-6 text-gold-gradient inline-block">Discography</h2>
          <div className="space-y-4">
            {artist.discography.map((d) => (
              <div key={d.title} className="flex justify-between items-center border-b border-border pb-4">
                <span className="font-display text-lg">{d.title}</span>
                <span className="text-sm text-muted-foreground">{d.year}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Press */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-6 text-gold-gradient inline-block">Press</h2>
          <div className="space-y-6">
            {artist.pressQuotes.map((q) => (
              <blockquote key={q.source} className="border-l-2 border-primary pl-6">
                <p className="text-lg italic text-foreground mb-2">"{q.quote}"</p>
                <cite className="text-sm text-muted-foreground not-italic">— {q.source}</cite>
              </blockquote>
            ))}
          </div>
        </div>

        {/* Booking & Socials */}
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-display font-bold mb-4 text-gold-gradient inline-block">Booking</h2>
            <p className="text-muted-foreground mb-4">For booking enquiries, please contact our management team.</p>
            <Link to="/contact" className="bg-gold-gradient text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-block">
              Contact for Booking
            </Link>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold mb-4 text-gold-gradient inline-block">Connect</h2>
            <div className="flex flex-col gap-2">
              {artist.socials.map((s) => (
                <a key={s.platform} href={s.url} className="text-muted-foreground hover:text-foreground transition-colors">
                  {s.platform}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ArtistProfile;
