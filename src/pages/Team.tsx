import Layout from "@/components/Layout";
import { executives } from "@/data/team";

const Team = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Leadership</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Executive Team</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          The leadership driving s2kDOTza's vision forward. Industry veterans with a shared commitment to excellence.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {executives.map((exec) => (
          <div key={exec.name} className="flex flex-col sm:flex-row gap-6">
            <div className="w-full sm:w-48 flex-shrink-0 aspect-[3/4] overflow-hidden rounded">
              <img src={exec.image} alt={exec.name} className="w-full h-full object-cover object-top grayscale" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">{exec.name}</h3>
              <p className="text-sm text-primary mb-3">{exec.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">{exec.bio}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Expertise: {exec.expertise}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </Layout>
);

export default Team;
