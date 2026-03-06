import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import heroImg from "@/assets/hero-studio.jpg";
import { artists } from "@/data/artists";
import { executives } from "@/data/team";
import { ArrowRight, Music, Mic2, Radio, Handshake, Clapperboard } from "lucide-react";

const services = [
  { icon: Mic2, title: "Artist Management", desc: "End-to-end career strategy and development." },
  { icon: Music, title: "Publishing", desc: "Global music publishing and licensing." },
  { icon: Radio, title: "Live Bookings", desc: "Tour planning and live event management." },
  { icon: Handshake, title: "Brand Partnerships", desc: "Strategic brand collaborations and endorsements." },
  { icon: Clapperboard, title: "Production & Creative", desc: "Full-service creative direction and production." },
];

const Index = () => (
  <Layout>
    {/* Hero */}
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Studio" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-background/70" />
      </div>
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6 animate-fade-in">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-tight mb-6">
          Built by Beats.<br />
          <span className="text-gold-gradient">Powered by Culture.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          A forward-thinking music and entertainment company. Turning Noise into Legacy.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/artists" className="bg-gold-gradient text-primary-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">
            Our Artists
          </Link>
          <Link to="/contact" className="border border-primary text-primary px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">
            Work With Us
          </Link>
          <Link to="/partnerships" className="border border-border text-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:border-primary hover:text-primary transition-colors">
            Partnerships
          </Link>
        </div>
      </div>
    </section>

    {/* About Snapshot */}
    <section className="section-padding max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Who We Are</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            Shaping the Future of Entertainment
          </h2>
        </div>
        <div>
          <p className="text-muted-foreground leading-relaxed mb-4">
            s2kDOTza Entertainment is a full-service music and entertainment company positioned at the intersection of culture, commerce, and creativity. We represent a curated roster of world-class talent and deliver enterprise-level services across management, publishing, and brand partnerships.
          </p>
          <Link to="/about" className="inline-flex items-center gap-2 text-primary text-sm uppercase tracking-widest hover:gap-3 transition-all">
            Learn More <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>

    {/* Artists Preview */}
    <section className="section-padding bg-card">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <p className="text-sm uppercase tracking-widest text-primary mb-2">The Roster</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">Our Artists</h2>
          </div>
          <Link to="/artists" className="hidden md:inline-flex items-center gap-2 text-primary text-sm uppercase tracking-widest hover:gap-3 transition-all">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {artists.map((artist) => (
            <Link key={artist.id} to={`/artists/${artist.id}`} className="group">
              <div className="aspect-[3/4] overflow-hidden mb-4">
                <img src={artist.image} alt={artist.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105" />
              </div>
              <h3 className="font-display text-lg font-semibold">{artist.name}</h3>
              <p className="text-sm text-muted-foreground">{artist.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>

    {/* Services */}
    <section className="section-padding">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-widest text-primary mb-2">What We Do</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold">Our Services</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {services.map((s) => (
            <div key={s.title} className="text-center group">
              <div className="w-14 h-14 mx-auto mb-4 border border-border rounded-sm flex items-center justify-center group-hover:border-primary transition-colors">
                <s.icon size={24} className="text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Executive Leadership */}
    <section className="section-padding bg-card">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <p className="text-sm uppercase tracking-widest text-primary mb-2">Leadership</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">Executive Team</h2>
          </div>
          <Link to="/team" className="hidden md:inline-flex items-center gap-2 text-primary text-sm uppercase tracking-widest hover:gap-3 transition-all">
            Full Team <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {executives.map((exec) => (
            <div key={exec.name}>
              <div className="aspect-[3/4] overflow-hidden mb-4">
                <img src={exec.image} alt={exec.name} className="w-full h-full object-cover grayscale" />
              </div>
              <h3 className="font-display font-semibold">{exec.name}</h3>
              <p className="text-sm text-primary">{exec.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Partners */}
    <section className="section-padding">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm uppercase tracking-widest text-primary mb-2">Strategic Affiliations</p>
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-12">Partners & Affiliates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {["Distribution Partners", "Label Affiliates", "Media Networks", "Brand Sponsors"].map((p) => (
            <div key={p} className="border border-border p-8 flex items-center justify-center">
              <span className="text-sm text-muted-foreground uppercase tracking-widest">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Contact CTA */}
    <section className="section-padding bg-card">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
          Let's Build Something{" "}
          <span className="text-gold-gradient">Global.</span>
        </h2>
        <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
          Whether you're an artist, brand, or investor — we're ready to create something extraordinary together.
        </p>
        <Link to="/contact" className="bg-gold-gradient text-primary-foreground px-10 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-block">
          Get In Touch
        </Link>
      </div>
    </section>
  </Layout>
);

export default Index;
