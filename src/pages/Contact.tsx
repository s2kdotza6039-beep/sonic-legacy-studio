import { useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const contactTypes = [
  { label: "Business Enquiries", email: "business@s2kdotza.com", value: "business" },
  { label: "Booking Enquiries", email: "bookings@s2kdotza.com", value: "booking" },
  { label: "Partnerships", email: "partnerships@s2kdotza.com", value: "partnership" },
  { label: "Press & Media", email: "press@s2kdotza.com", value: "press" },
];

const departmentOptions = [
  { label: "Business Enquiry", value: "business" },
  { label: "Booking", value: "booking" },
  { label: "Partnership", value: "partnership" },
  { label: "Press", value: "press" },
  { label: "Other", value: "other" },
];

const initialForm = {
  full_name: "",
  email: "",
  department: "business",
  subject: "",
  message: "",
};

const Contact = () => {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fallbackEmail =
    contactTypes.find(c => c.value === form.department)?.email || "business@s2kdotza.com";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Silent honeypot — bots fill hidden fields.
    if (honeypot.trim()) { setSubmitted(true); return; }

    const name = form.full_name.trim();
    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (name.length < 2 || name.length > 120) {
      toast({ title: "Please enter your full name", variant: "destructive" }); return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
      toast({ title: "Please enter a valid email address", variant: "destructive" }); return;
    }
    if (subject.length < 3 || subject.length > 200) {
      toast({ title: "Please add a short subject", variant: "destructive" }); return;
    }
    if (message.length < 10 || message.length > 5000) {
      toast({ title: "Please write a message of at least 10 characters", variant: "destructive" }); return;
    }

    // Simple client-side throttle: one enquiry per minute per browser.
    const last = Number(localStorage.getItem("contact_last_submit") || 0);
    if (Date.now() - last < 60_000) {
      toast({
        title: "Please wait a moment",
        description: "You can send another enquiry in a minute.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_enquiries").insert({
      full_name: name,
      email,
      department: form.department,
      subject,
      message,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "We couldn't record your enquiry",
        description: `Please email us directly at ${fallbackEmail}.`,
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("contact_last_submit", String(Date.now()));
    setForm(initialForm);
    setSubmitted(true);
    toast({
      title: "Enquiry received",
      description: "It is saved in our enquiry desk. Our team reviews enquiries within 30 days.",
    });
  };

  return (
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
            {submitted ? (
              <div className="border border-border bg-card p-6 space-y-3">
                <p className="text-sm text-foreground">Enquiry received.</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your message is saved in our enquiry desk and our team reviews enquiries within 30 days. If it is urgent,
                  you can also email <a href={`mailto:${fallbackEmail}`} className="text-primary hover:underline">{fallbackEmail}</a>.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={submit}>
                <div>
                  <label htmlFor="full_name" className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Full Name</label>
                  <input id="full_name" type="text" required maxLength={120} value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Email</label>
                  <input id="email" type="email" required maxLength={200} value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label htmlFor="department" className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Subject</label>
                  <select id="department" value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors">
                    {departmentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="subject" className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Headline</label>
                  <input id="subject" type="text" required maxLength={200} value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}
                    className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label htmlFor="message" className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Message</label>
                  <textarea id="message" rows={5} required maxLength={5000} value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors resize-none" />
                </div>

                {/* Honeypot — hidden from people, tempting to bots */}
                <input
                  type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  value={honeypot} onChange={e => setHoneypot(e.target.value)}
                  className="hidden" name="company_website"
                />

                <button type="submit" disabled={submitting}
                  className="bg-gold-gradient text-primary-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {submitting ? "Sending..." : "Send Message"}
                </button>
                <p className="text-xs text-muted-foreground">
                  Your enquiry is recorded for our team to review. If anything goes wrong you can email{" "}
                  <a href={`mailto:${fallbackEmail}`} className="text-primary hover:underline">{fallbackEmail}</a> directly.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contact;
