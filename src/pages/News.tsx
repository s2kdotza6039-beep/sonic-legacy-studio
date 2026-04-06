import Layout from "@/components/Layout";

const newsItems = [
  {
    date: "April 2026",
    category: "Company Announcement",
    title: "s2kDOTza Entertainment — The Movement Has Begun",
    excerpt: `This is more than just an update. This is a statement.

s2kDOTza Entertainment is officially in motion — built from the ground up with purpose, structure, and a deep respect for the culture that raised us. From the streets of South Africa to the global stage, we are creating a platform where talent is not just seen… but built, measured, and elevated.

We are not here to follow trends. We are here to create systems.

At s2kDOTza, we believe in: Real artists with real stories. Real work that produces real results. Real opportunities that lead to real income.

This is where street culture meets business discipline. Where creativity meets structure. Where passion meets execution.

Our roots are proudly South African — shaped by the energy, resilience, and rhythm of our communities. But our vision is global. We are building something that speaks to Johannesburg, Lagos, New York, London, and everywhere in between.

Through live events, digital content, and artist development, we are creating a movement that connects the streets to the boardroom — without losing authenticity.

To the artists: This is your platform — if you're ready to work.
To the fans: This is your culture — and you're part of it.
To the brands and partners: This is your gateway into real, measurable, and powerful engagement with the culture.

We are just getting started. The foundation is set. The system is in place. Now it's time to build.

s2kDOTza Entertainment — Platform. Culture. Structure. Global Vision.`,
  },
];

const News = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">News & Press</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Latest Updates</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Press releases, company announcements, and artist milestones.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-4xl mx-auto">
      <div className="space-y-12">
        {newsItems.map((item) => (
          <article key={item.title} className="border-b border-border pb-12">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-xs uppercase tracking-widest text-primary">{item.category}</span>
              <span className="text-xs text-muted-foreground">{item.date}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold mb-3">{item.title}</h2>
            <div className="text-muted-foreground leading-relaxed whitespace-pre-line">{item.excerpt}</div>
          </article>
        ))}
      </div>
    </div>
  </Layout>
);

export default News;
