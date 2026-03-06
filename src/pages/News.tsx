import Layout from "@/components/Layout";

const newsItems = [
  {
    date: "February 2026",
    category: "Company Announcement",
    title: "s2kDOTza Entertainment Announces International Expansion",
    excerpt: "The company is set to open offices in London and Lagos as part of its global growth strategy, strengthening its presence in key music markets across Europe and West Africa.",
  },
  {
    date: "January 2026",
    category: "Artist Milestone",
    title: "KXNG Velo's 'Crown Theory' Surpasses 10 Million Streams",
    excerpt: "The breakout debut album from KXNG Velo has crossed the 10 million stream mark across all platforms, solidifying his position as one of the year's most exciting new voices.",
  },
  {
    date: "December 2025",
    category: "Press",
    title: "Aura Cole Featured in Rolling Stone Africa's 'Artists to Watch'",
    excerpt: "Aura Cole has been named among Rolling Stone Africa's top artists to watch in 2026, following the critical success of her album 'Golden Hour'.",
  },
  {
    date: "November 2025",
    category: "Partnership",
    title: "s2kDOTza Signs Strategic Partnership with Global Distribution Platform",
    excerpt: "A new multi-year distribution agreement will give s2kDOTza artists access to enhanced global distribution infrastructure and marketing support across 180+ territories.",
  },
  {
    date: "October 2025",
    category: "Media",
    title: "CEO Marcus Van Der Berg Keynotes at African Music Business Summit",
    excerpt: "Marcus Van Der Berg delivered the opening keynote at the AMBS, outlining his vision for the professionalization of the African music industry.",
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
            <p className="text-muted-foreground leading-relaxed">{item.excerpt}</p>
          </article>
        ))}
      </div>
    </div>
  </Layout>
);

export default News;
