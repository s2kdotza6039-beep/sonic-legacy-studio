import Layout from "@/components/Layout";
import { Lock, LogOut, User, LayoutDashboard, Users, Film, DollarSign, Music, Star, Lightbulb, FileText, BookOpen, NotebookPen, ShieldCheck, Disc3, Headphones, ReceiptText, Activity, Cloud, ShieldAlert } from "lucide-react";
import MusicAdmin from "@/components/dashboard/MusicAdmin";
import PayFastAuditLog from "@/components/dashboard/PayFastAuditLog";
import PlaybackAuditLog from "@/components/dashboard/PlaybackAuditLog";
import ReleaseClicksPanel from "@/components/dashboard/ReleaseClicksPanel";
import SecurityEventsPanel from "@/components/dashboard/SecurityEventsPanel";
import SecurityAlertsPanel from "@/components/dashboard/SecurityAlertsPanel";
import SecurityDeliveryMetrics from "@/components/dashboard/SecurityDeliveryMetrics";
import SecurityMetaRuleCharts from "@/components/dashboard/SecurityMetaRuleCharts";
import SecurityAuditLogViewer from "@/components/dashboard/SecurityAuditLogViewer";

import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import ArtistPipeline from "@/components/dashboard/ArtistPipeline";
import ContentEngine from "@/components/dashboard/ContentEngine";
import RevenuePipeline from "@/components/dashboard/RevenuePipeline";
import RemindersPanel from "@/components/dashboard/RemindersPanel";
import ArtistScorecard from "@/components/dashboard/ArtistScorecard";
import IdeasBoard from "@/components/dashboard/IdeasBoard";
import ContractVault from "@/components/dashboard/ContractVault";
import BettingSystem from "@/components/dashboard/BettingSystem";
import CeoDiary from "@/components/dashboard/CeoDiary";
import CeoNotepad from "@/components/dashboard/ceo/CeoNotepad";
import AICommandCentre from "@/components/dashboard/AICommandCentre";
import ReleasesManager from "@/components/dashboard/ReleasesManager";
import { Target } from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "command", label: "AI Command", icon: ShieldCheck },
  { key: "ceo", label: "CEO Diary", icon: BookOpen },
  { key: "notepad", label: "Notepad", icon: NotebookPen },
  { key: "artists", label: "Artists", icon: Users },
  { key: "scorecard", label: "Scorecard", icon: Star },
  { key: "ideas", label: "Ideas", icon: Lightbulb },
  { key: "content", label: "Content", icon: Film },
  { key: "releases", label: "Releases", icon: Disc3 },
  { key: "revenue", label: "Revenue", icon: DollarSign },
  { key: "contracts", label: "Contracts", icon: FileText },
  { key: "betting", label: "AI Betting", icon: Target },
  { key: "music", label: "Music Admin", icon: Headphones },
  { key: "payfast", label: "PayFast Log", icon: ReceiptText },
  { key: "playback", label: "Playback Log", icon: Activity },
  { key: "cloudclicks", label: "Cloud Clicks", icon: Cloud },
  { key: "security", label: "Security", icon: ShieldAlert },
] as const;


type TabKey = (typeof TABS)[number]["key"];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("overview");

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "You've been logged out." });
    navigate("/");
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Lock size={20} className="text-primary" />
                <p className="text-sm uppercase tracking-widest text-primary">Command Center</p>
              </div>
              <h1 className="text-3xl md:text-5xl font-display font-bold">Team Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/royalties" className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors border border-border px-3 py-2">
                <Music size={14} /> Royalty Audit
              </Link>
              <div className="flex items-center gap-4 bg-secondary/50 border border-border px-4 py-2">
                <User size={14} className="text-primary" />
                <span className="text-xs text-muted-foreground">{user?.email}</span>
                <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <LogOut size={12} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-padding max-w-5xl mx-auto">
        {/* Metrics */}
        <MetricsPanel />

        {/* Tabs */}
        <div className="flex gap-2 mt-8 mb-6 border-b border-border pb-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {tab === "overview" && (
              <div className="space-y-6">
                <ArtistPipeline />
                <RevenuePipeline />
              </div>
            )}
            {tab === "command" && <AICommandCentre />}
            {tab === "ceo" && <CeoDiary />}
            {tab === "notepad" && <CeoNotepad />}
            {tab === "artists" && <ArtistPipeline />}
            {tab === "scorecard" && <ArtistScorecard />}
            {tab === "ideas" && <IdeasBoard />}
            {tab === "content" && <ContentEngine />}
            {tab === "releases" && <ReleasesManager />}
            {tab === "revenue" && <RevenuePipeline />}
            {tab === "contracts" && <ContractVault />}
            {tab === "betting" && <BettingSystem />}
            {tab === "music" && <MusicAdmin />}
            {tab === "payfast" && <PayFastAuditLog />}
            {tab === "playback" && <PlaybackAuditLog />}
            {tab === "cloudclicks" && <ReleaseClicksPanel />}
            {tab === "security" && (
              <div className="space-y-4">
                <SecurityEventsPanel />
                <SecurityDeliveryMetrics />
                <SecurityAlertsPanel />
                <SecurityAuditLogViewer />
              </div>
            )}

          </div>
          <div>
            <RemindersPanel />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
