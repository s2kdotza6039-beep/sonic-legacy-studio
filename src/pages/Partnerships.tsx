import Layout from "@/components/Layout";
import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Platinum Partner",
    description: "Full integration with s2kDOTza's roster, events, and brand initiatives. Includes co-branded campaigns, exclusive event access, and strategic advisory.",
  },
  {
    name: "Gold Partner",
    description: "Priority access to artist endorsements, content collaborations, and event sponsorship opportunities. Ideal for brands seeking sustained cultural engagement.",
  },
  {
    name: "Silver Partner",
    description: "Entry-level partnership with access to co-marketing opportunities, event branding, and introductions to our artist roster for project-based collaborations.",
  },
];

const Partnerships = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Partnerships</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Invest in Culture</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          We partner with forward-thinking brands, investors, and institutions to build meaningful, profitable alliances at the intersection of music and business.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-5xl mx-auto">
      {/* Sponsorship Opportunities */}
      <div className="mb-20">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">Sponsorship Opportunities</h2>
        <p className="text-muted-foreground leading-relaxed text-lg mb-8">
          From flagship events and tours to digital campaigns and content series — our sponsorship packages are designed to deliver measurable impact and authentic cultural alignment.
        </p>
      </div>

      {/* Partnership Tiers */}
      <div className="mb-20">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-8 text-gold-gradient inline-block">Partnership Tiers</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((t) => (
            <div key={t.name} className="border border-border p-8 hover:border-primary transition-colors">
              <h3 className="font-display text-xl font-bold mb-4">{t.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Collaboration */}
      <div className="mb-20">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">Brand Collaboration Deck</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Download our comprehensive partnership deck for detailed information on sponsorship packages, case studies, and collaboration opportunities.
        </p>
        <a href="/s2kDOTza_Brand_Collaboration_Deck.pdf" download className="border border-primary text-primary px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:bg-primary hover:text-primary-foreground transition-colors inline-block">
          Download PDF Deck
        </a>
      </div>

      {/* CTA */}
      <div className="text-center border-t border-border pt-16">
        <h2 className="text-3xl font-display font-bold mb-4">Ready to Partner?</h2>
        <p className="text-muted-foreground mb-8">Submit a proposal and our partnerships team will be in touch within 48 hours.</p>
        <Link to="/contact" className="bg-gold-gradient text-primary-foreground px-10 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-block">
          Contact for Proposals
        </Link>
      </div>
    </div>
  </Layout>
);

export default Partnerships;
