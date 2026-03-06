import Layout from "@/components/Layout";

const sections = [
  {
    title: "Our Mission",
    content: "To discover, develop, and amplify world-class talent while building sustainable business models that empower artists and drive cultural impact on a global scale.",
  },
  {
    title: "Our Vision",
    content: "To be the leading entertainment company originating from Africa, setting the standard for artist development, creative excellence, and international market expansion.",
  },
  {
    title: "Company History",
    content: "Founded with a clear mandate to professionalize the music industry, s2kDOTza Entertainment has grown from a boutique management firm into a multi-disciplinary entertainment company. Over the years, we have built partnerships with major international labels, developed platinum-selling artists, and expanded our operations across publishing, brand strategy, and live entertainment.",
  },
  {
    title: "Core Values",
    content: "Excellence in execution. Integrity in every deal. Innovation at every level. We believe that great music deserves great business — and we operate with the discipline and ambition of a global enterprise.",
  },
  {
    title: "Industry Positioning",
    content: "s2kDOTza sits at the intersection of African creativity and global commerce. We are uniquely positioned to bridge emerging talent markets with established international platforms, offering our artists unparalleled reach and our partners access to the fastest-growing music markets in the world.",
  },
  {
    title: "Future Growth Strategy",
    content: "Our roadmap includes expansion into digital distribution, music technology, investor partnerships, and international touring infrastructure. We are building not just for today's artists, but for the next generation of the global music industry.",
  },
];

const About = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">About</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">The Company</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Structured for scale. Driven by culture. Built to last.
        </p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto section-padding">
      <div className="space-y-16">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-gold-gradient inline-block">{s.title}</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  </Layout>
);

export default About;
