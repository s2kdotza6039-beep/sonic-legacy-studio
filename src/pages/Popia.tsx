import Layout from "@/components/Layout";

const Popia = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">POPIA Compliance</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">POPIA Compliance</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          We aim to comply with the Protection of Personal Information Act (POPIA) in our handling of personal data.
        </p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto section-padding space-y-8 text-muted-foreground leading-relaxed text-lg">
      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Data Protection Principles</h2>
        <p>We collect and process personal information lawfully, transparently and for specific purposes only.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Your Rights</h2>
        <p>Individuals may request access to, correction of, or deletion of their personal information where applicable.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Security Measures</h2>
        <p>We implement appropriate technical and organisational measures to safeguard personal information against loss, damage, or unauthorised access.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Contact</h2>
        <p>Please contact us if you have privacy questions or want to exercise your data protection rights.</p>
      </section>
    </div>
  </Layout>
);

export default Popia;
