import Layout from "@/components/Layout";
import { useState } from "react";

const Careers = () => {
  const [formType, setFormType] = useState<"talent" | "internship" | "business">("talent");

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Careers & Submissions</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Join the Movement</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            We're always looking for exceptional talent — on stage and behind the scenes.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-3xl mx-auto">
        {/* Type Selector */}
        <div className="flex flex-wrap gap-4 mb-12">
          {([
            { key: "talent" as const, label: "Talent Submission" },
            { key: "internship" as const, label: "Internship" },
            { key: "business" as const, label: "Business Enquiry" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setFormType(t.key)}
              className={`px-6 py-2 text-sm uppercase tracking-widest border transition-colors ${
                formType === t.key
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Full Name</label>
              <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Email</label>
              <input type="email" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
          </div>

          {formType === "talent" && (
            <>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Genre / Style</label>
                <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Link to Music (Spotify, SoundCloud, etc.)</label>
                <input type="url" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
              </div>
            </>
          )}

          {formType === "internship" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Area of Interest</label>
              <input type="text" placeholder="e.g. A&R, Marketing, Legal" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors placeholder:text-muted-foreground/50" />
            </div>
          )}

          {formType === "business" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Company / Organization</label>
              <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Message</label>
            <textarea rows={5} className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors resize-none" />
          </div>

          <button type="submit" className="bg-gold-gradient text-primary-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">
            Submit
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Careers;
