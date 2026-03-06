import Layout from "@/components/Layout";
import { Link } from "react-router-dom";

const services = [
  {
    title: "Artist Management",
    description: "Comprehensive career management from strategy to execution. We guide every aspect of an artist's journey — from brand identity and release strategy to touring and international expansion.",
    audience: "Emerging and established artists seeking professional, long-term career partners.",
    differentiator: "We don't just manage careers — we architect them. Our approach combines data-driven strategy with deep industry relationships.",
  },
  {
    title: "Music Publishing",
    description: "Global publishing and licensing services that maximize your catalogue's earning potential. We handle sync placements, mechanical royalties, and international sub-publishing relationships.",
    audience: "Songwriters, producers, and rights holders looking for proactive publishing partners.",
    differentiator: "Our global network ensures your music works for you in every market, across every platform.",
  },
  {
    title: "A&R Development",
    description: "We identify and develop the next generation of musical talent. Our A&R team works closely with artists to refine their sound, build their identity, and prepare them for market.",
    audience: "Unsigned artists and producers with exceptional raw talent and ambition.",
    differentiator: "We invest in development, not just discovery. Our artists are market-ready before their first release.",
  },
  {
    title: "Brand Strategy",
    description: "Strategic brand partnerships and endorsement deals that align with an artist's identity and values. We connect culture with commerce in authentic, impactful ways.",
    audience: "Brands seeking authentic cultural partnerships and artists looking to diversify revenue.",
    differentiator: "We understand both sides of the table — artist credibility and brand objectives.",
  },
  {
    title: "Touring & Live Events",
    description: "Full-service tour planning, booking, and live event production. From intimate showcases to stadium tours, we deliver world-class live experiences.",
    audience: "Artists ready for live performance at any scale.",
    differentiator: "Our touring infrastructure spans multiple continents with trusted local partners in every key market.",
  },
  {
    title: "Media & Content Production",
    description: "End-to-end content creation — music videos, documentaries, social content, and visual campaigns. We bring artistic vision to life with cinematic quality.",
    audience: "Artists and brands requiring premium visual content.",
    differentiator: "Every piece of content is treated as a cultural moment, not just a deliverable.",
  },
];

const Services = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Services</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">What We Offer</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Enterprise-level services for every stage of an artist's career and every facet of the entertainment business.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-5xl mx-auto">
      <div className="space-y-20">
        {services.map((s, i) => (
          <div key={s.title} className="border-l-2 border-primary pl-8">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">0{i + 1}</span>
            <h2 className="text-2xl md:text-3xl font-display font-bold mt-2 mb-4">{s.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{s.description}</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary mb-1">Who It's For</p>
                <p className="text-sm text-muted-foreground">{s.audience}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-primary mb-1">Why We're Different</p>
                <p className="text-sm text-muted-foreground">{s.differentiator}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 text-center">
        <Link to="/contact" className="bg-gold-gradient text-primary-foreground px-10 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-block">
          Discuss Your Needs
        </Link>
      </div>
    </div>
  </Layout>
);

export default Services;
