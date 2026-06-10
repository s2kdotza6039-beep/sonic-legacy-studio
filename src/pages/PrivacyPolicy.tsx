import Layout from "@/components/Layout";

const PrivacyPolicy = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Privacy Policy</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Privacy Policy</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          We are committed to protecting your privacy and handling your personal information responsibly.
        </p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto section-padding space-y-8 text-muted-foreground leading-relaxed text-lg">
      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Information We Collect</h2>
        <p>We collect information that you provide directly to us, including contact details, account details, and any messages or support requests you submit.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">How We Use Information</h2>
        <p>We use your information to provide and improve our services, respond to requests, communicate with you, and comply with legal obligations.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Security</h2>
        <p>We take reasonable technical and organizational measures to protect your information from unauthorized access and misuse.</p>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact us through the contact page.</p>
      </section>
    </div>
  </Layout>
);

export default PrivacyPolicy;
