import Layout from "@/components/Layout";

const contactTypes = [
  { label: "Business Enquiries", email: "business@s2kdotza.com" },
  { label: "Booking Enquiries", email: "bookings@s2kdotza.com" },
  { label: "Partnerships", email: "partnerships@s2kdotza.com" },
  { label: "Press & Media", email: "press@s2kdotza.com" },
];

const Contact = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Contact</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Get in Touch</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          For all enquiries, please reach out through the appropriate channel below.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16">
        {/* Contact Channels */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-8 text-gold-gradient inline-block">Departments</h2>
          <div className="space-y-6">
            {contactTypes.map((c) => (
              <div key={c.label} className="border-b border-border pb-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{c.label}</p>
                <a href={`mailto:${c.email}`} className="text-foreground hover:text-primary transition-colors">{c.email}</a>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-display font-bold mb-4 text-gold-gradient inline-block">Office</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              s2kDOTza Entertainment<br />
              Johannesburg, South Africa
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-8 text-gold-gradient inline-block">Send a Message</h2>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Full Name</label>
              <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Email</label>
              <input type="email" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Subject</label>
              <select className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors">
                <option>Business Enquiry</option>
                <option>Booking</option>
                <option>Partnership</option>
                <option>Press</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Message</label>
              <textarea rows={5} className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors resize-none" />
            </div>
            <button type="submit" className="bg-gold-gradient text-primary-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  </Layout>
);

export default Contact;
