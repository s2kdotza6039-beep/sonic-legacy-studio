import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, Presentation } from "lucide-react";

const tiers = [
  {
    id: "tier-1",
    badge: "Silver Tier • Low-Risk Entry",
    name: "Starter Partner",
    price: "R7,500 – R12,000 per event",
    ideal: "First-time sponsors, local brands, pilot activations",
    receives: [
      "Logo placement at 1 live event",
      "Verbal mention by host/artist (1x)",
      "Logo on 2–3 social media posts",
      "Inclusion in post-event recap",
    ],
    delivers: [
      "Clean, responsible brand placement",
      "Controlled audience exposure",
      "Basic post-event report",
    ],
  },
  {
    id: "tier-2",
    badge: "Gold Tier • Recommended Core Package",
    name: "Partner",
    price: "R25,000 – R40,000 per month",
    ideal: "Lifestyle, fashion, alcohol, telecoms brands",
    receives: [
      "Co-branding at 1–2 monthly events",
      "Stage or backdrop logo placement",
      "4–6 branded social media posts",
      "Product placement / activation space",
      "Brand mentions across live & digital",
    ],
    delivers: [
      "Consistent monthly exposure",
      "Strong audience engagement",
      "High-quality reusable content assets",
    ],
  },
  {
    id: "tier-3",
    badge: "Platinum Tier • Premium / Limited",
    name: "Title Sponsor",
    price: "R60,000 – R120,000+ per month",
    ideal: "Primary brand partner per event series",
    receives: [
      "Event naming rights (\"Brand X presents s2kDOTza Live\")",
      "Dominant logo placement across all platforms",
      "Exclusive category rights",
      "Custom brand activations",
      "Artist and content integration",
      "Full post-event report + media assets",
    ],
    delivers: [
      "Brand ownership of the experience",
      "Deep cultural integration",
      "Priority positioning across all touchpoints",
    ],
  },
];

const reachStats = [
  { label: "Estimated Attendance", value: "200 – 800+ per event" },
  { label: "Monthly Reach", value: "10,000 – 50,000+ impressions" },
  { label: "Audience Profile", value: "Urban youth, culture-driven, music-focused consumers" },
];

const addOns = [
  { label: "Extra social media content", value: "R3,000 – R6,000" },
  { label: "Artist meet & greet", value: "R5,000" },
  { label: "Branded competition", value: "R4,000" },
  { label: "Custom video content", value: "R6,000 – R10,000" },
];

const categoryActivations = [
  {
    icon: "🍾",
    title: "Alcohol Brands",
    items: ["18+ venues only", "Responsible messaging", "Controlled brand presence"],
  },
  {
    icon: "👕",
    title: "Fashion Brands",
    items: ["Artist styling integration", "Pop-up or runway activations", "Content-driven campaigns"],
  },
  {
    icon: "📡",
    title: "Telecoms / Tech",
    items: ["Wi-Fi zones", "Live streaming support", "Data-driven engagement reporting"],
  },
];

const TierBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <h4 className="text-xs uppercase tracking-widest text-primary mb-3">{title}</h4>
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i} className="text-sm text-muted-foreground flex gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{i}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Partnerships = () => (
  <Layout>
    {/* Hero */}
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Partnerships & Investment</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Invest in Culture</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          We don't sell exposure — we build consistent cultural presence.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-6xl mx-auto space-y-24">
      {/* SECTION 1: Sponsor Packages & Pricing — Tier Cards */}
      <section>
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Section 1</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-gold-gradient inline-block">
            Partnership Investment Tiers
          </h2>
          <p className="text-muted-foreground italic max-w-2xl mx-auto">
            We don't sell exposure — we build consistent cultural presence.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {tiers.map((t) => (
            <AccordionItem
              key={t.id}
              value={t.id}
              className="border border-border hover:border-primary/50 transition-colors data-[state=open]:border-primary"
            >
              <AccordionTrigger className="px-6 py-6 hover:no-underline">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-3 text-left pr-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary mb-1">🟨 {t.badge}</p>
                    <h3 className="font-display text-2xl font-bold">{t.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-gold-gradient inline-block font-bold">{t.price}</p>
                    <p className="text-xs text-muted-foreground mt-1">Click to expand</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="border-t border-border pt-6 space-y-8">
                  <p className="text-sm">
                    <span className="text-xs uppercase tracking-widest text-primary mr-2">Ideal for:</span>
                    <span className="text-muted-foreground">{t.ideal}</span>
                  </p>

                  <div className="grid md:grid-cols-2 gap-8">
                    <TierBlock title="What the Brand Receives" items={t.receives} />
                    <TierBlock title="What We Deliver" items={t.delivers} />
                  </div>

                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Audience & Reach</h4>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {reachStats.map((s) => (
                        <div key={s.label} className="border border-border p-4">
                          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                          <p className="text-sm">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-primary mb-3">➕ Optional Add-Ons</h4>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {addOns.map((a) => (
                        <div key={a.label} className="flex justify-between border-b border-border py-2 text-sm">
                          <span className="text-muted-foreground">{a.label}</span>
                          <span className="text-primary font-medium">{a.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* SECTION 2: Partnership / Visual */}
      <section>
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Section 2</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-gold-gradient inline-block">
            🎥 Experience & Brand Integration
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our events are designed to create high-impact brand visibility across live experiences and digital platforms.
          </p>
        </div>

        <p className="text-sm text-muted-foreground mb-8 text-center">Each partnership is translated into:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {["Stage presence", "Crowd engagement", "Content distribution", "Cultural relevance"].map((item) => (
            <div key={item} className="border border-border p-6 text-center hover:border-primary transition-colors">
              <p className="font-display text-lg">{item}</p>
            </div>
          ))}
        </div>

        {/* Visual placeholder grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="aspect-video border border-dashed border-border bg-card/50 flex items-center justify-center text-muted-foreground text-sm"
            >
              Visual / Promo Video {n}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: Extra Information */}
      <section>
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Section 3</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-gold-gradient inline-block">
            🎯 Category-Specific Activation
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {categoryActivations.map((c) => (
            <div key={c.title} className="border border-border p-6 hover:border-primary transition-colors">
              <p className="text-3xl mb-3">{c.icon}</p>
              <h3 className="font-display text-xl font-bold mb-4">{c.title}</h3>
              <ul className="space-y-2">
                {c.items.map((i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Reporting */}
        <div className="border border-primary/30 p-8 mb-16">
          <h3 className="text-xl font-display font-bold mb-4">📊 Reporting & Deliverables</h3>
          <p className="text-sm text-muted-foreground mb-4">All partners receive:</p>
          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            {[
              "Attendance metrics",
              "Content reach & engagement",
              "Photo & video assets",
              "Post-event performance summary",
            ].map((i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-primary">✔</span>
                {i}
              </div>
            ))}
          </div>
          <p className="text-xs uppercase tracking-widest text-primary">Transparency builds long-term value.</p>
        </div>

        {/* Case Study */}
        <div className="border border-border p-8 mb-12">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">📊 Case Study</p>
          <h3 className="text-2xl font-display font-bold mb-6">Campaign Highlight: s2kDOTza Live Session</h3>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Objective</h4>
              <p className="text-sm text-muted-foreground">
                To create a culturally relevant live music experience while integrating brand visibility and audience engagement.
              </p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Execution</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Live performance featuring core artists</li>
                <li>• Branded stage and environment</li>
                <li>• Social media content capture</li>
                <li>• Audience interaction and engagement</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Results</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Attendance: 300+ attendees</li>
                <li>• Digital Reach: 15,000+ impressions</li>
                <li>• Content Produced: 20+ media assets</li>
                <li>• High audience interaction & retention</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Next Step For Brands</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              {["Identify fit", "Select package", "Customise activation", "Sign agreement"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="text-primary font-bold">{i + 1}.</span>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center border-t border-border pt-12">
          <Link
            to="/contact"
            className="bg-gold-gradient text-primary-foreground px-10 py-4 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-block mb-4"
          >
            Start Partnership Discussion
          </Link>
          <p className="text-muted-foreground italic max-w-2xl mx-auto">
            "We don't sell exposure — we build consistent cultural presence."
          </p>
          <p className="text-xs text-muted-foreground mt-6">
            s2kDOTza Entertainment • Founded by Thulani "Pitch Black Afro" Ngcobo
          </p>
        </div>
      </section>

      {/* SECTION 4: Pitch Deck */}
      <section className="border border-border p-10">
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">
          <Presentation size={48} className="text-primary mx-auto md:mx-0" />
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">Section 4</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Sponsor & Brand Pitch Deck</h2>
            <p className="text-muted-foreground text-sm">
              16-slide investor and sponsor presentation covering audience, platforms, leadership, and partnership opportunities.
            </p>
          </div>
          <a
            href="/s2kDOTza_Pitch_Deck.pdf"
            download
            className="bg-gold-gradient text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={16} /> Download Pitch Deck
          </a>
        </div>
      </section>

      {/* SECTION 5: Brand Collaboration Deck */}
      <section className="border border-border p-10">
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">
          <FileText size={48} className="text-primary mx-auto md:mx-0" />
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">Section 5</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Brand Collaboration Deck</h2>
            <p className="text-muted-foreground text-sm">
              Strategic brand partnerships and cultural market access — international ecosystem overview, partnership tiers, and activation channels.
            </p>
          </div>
          <a
            href="/s2kDOTza_Brand_Collaboration_Deck.pdf"
            download
            className="border border-primary text-primary px-6 py-3 text-sm uppercase tracking-widest font-semibold hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={16} /> Download Brand Deck
          </a>
        </div>
      </section>
    </div>
  </Layout>
);

export default Partnerships;
