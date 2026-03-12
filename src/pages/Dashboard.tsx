import Layout from "@/components/Layout";
import { Lock, Globe, Mail, Youtube, Instagram } from "lucide-react";

const Dashboard = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-primary/30 mb-8">
          <Lock size={32} className="text-primary" />
        </div>
        <p className="text-sm uppercase tracking-widest text-primary mb-4">Private Portal</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Team Dashboard</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Secure access for the founding team, executives, and artists. Quick links to all social media pages, email accounts, and management tools.
        </p>
      </div>
    </div>

    <div className="section-padding max-w-5xl mx-auto">
      {/* Coming Soon Notice */}
      <div className="border border-border bg-card p-8 md:p-12 text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm uppercase tracking-widest px-4 py-2 mb-6">
          <Globe size={14} />
          Domain Pending
        </div>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
          Login Coming <span className="text-gold-gradient">Soon</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-8">
          Once the domain is secured, this page will feature a secure login system for the founding team, executives, and signed artists to access their dashboards.
        </p>

        {/* Preview of what's coming */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="border border-border p-6 bg-secondary/30">
            <h3 className="font-display font-bold text-lg mb-2">Founder & Execs</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail size={14} className="text-primary" /> Business Email Access</li>
              <li className="flex items-center gap-2"><Instagram size={14} className="text-primary" /> Social Media Pages</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Management Tools</li>
            </ul>
          </div>

          <div className="border border-border p-6 bg-secondary/30">
            <h3 className="font-display font-bold text-lg mb-2">Artists</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Youtube size={14} className="text-primary" /> YouTube Channel</li>
              <li className="flex items-center gap-2"><Instagram size={14} className="text-primary" /> Social Accounts</li>
              <li className="flex items-center gap-2"><Mail size={14} className="text-primary" /> Artist Email</li>
            </ul>
          </div>

          <div className="border border-border p-6 bg-secondary/30">
            <h3 className="font-display font-bold text-lg mb-2">Quick Links</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Distribution Portals</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Publishing Admin</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Booking Calendar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Layout>
);

export default Dashboard;
