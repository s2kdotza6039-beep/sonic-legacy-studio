import Layout from "@/components/Layout";

const newsItems: { date: string; category: string; title: string; excerpt: string }[] = [];

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
