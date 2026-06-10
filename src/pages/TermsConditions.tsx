import Layout from "@/components/Layout";

const TermsConditions = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Terms and Conditions</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Terms and Conditions</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          These terms govern your use of our services and your relationship with S2KDOTZA Entertainment.
        </p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto section-padding space-y-8 text-muted-foreground leading-relaxed text-lg">
      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Acceptance of Terms</h2>
        <p>By using this website, you agree to these Terms and Conditions and our Privacy Policy.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Use of Site</h2>
        <p>You may use our website for lawful purposes only and must comply with all applicable laws and regulations.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Intellectual Property</h2>
        <p>All content, designs, and trademarks are owned or licensed by S2KDOTZA Entertainment unless otherwise stated.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Limitation of Liability</h2>
        <p>We are not responsible for losses or damages that arise from your use of the website except where required by law.</p>
      </section>
    </div>
  </Layout>
);

export default TermsConditions;
