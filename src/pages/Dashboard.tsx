import Layout from "@/components/Layout";
import { Lock, Globe, Mail, Youtube, Instagram, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "You've been logged out." });
    navigate("/");
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-primary/30 mb-8">
            <Lock size={32} className="text-primary" />
          </div>
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Private Portal</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Team Dashboard</h1>

          {/* User info & logout */}
          <div className="inline-flex items-center gap-4 bg-secondary/50 border border-border px-6 py-3 mb-6">
            <User size={16} className="text-primary" />
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors ml-4"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Secure access for the founding team, executives, and artists. Quick links to all social media pages, email accounts, and management tools.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-border p-6 bg-card">
            <h3 className="font-display font-bold text-lg mb-2">Founder & Execs</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail size={14} className="text-primary" /> Business Email Access</li>
              <li className="flex items-center gap-2"><Instagram size={14} className="text-primary" /> Social Media Pages</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Management Tools</li>
            </ul>
          </div>

          <div className="border border-border p-6 bg-card">
            <h3 className="font-display font-bold text-lg mb-2">Artists</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Youtube size={14} className="text-primary" /> YouTube Channel</li>
              <li className="flex items-center gap-2"><Instagram size={14} className="text-primary" /> Social Accounts</li>
              <li className="flex items-center gap-2"><Mail size={14} className="text-primary" /> Artist Email</li>
            </ul>
          </div>

          <div className="border border-border p-6 bg-card">
            <h3 className="font-display font-bold text-lg mb-2">Quick Links</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Distribution Portals</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Publishing Admin</li>
              <li className="flex items-center gap-2"><Globe size={14} className="text-primary" /> Booking Calendar</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
