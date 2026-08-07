import Layout from "@/components/Layout";
import { Lock, LogOut, User, LayoutDashboard, Users, Film, DollarSign, Music, Star, Lightbulb, FileText, BookOpen, BookLock, NotebookPen, ShieldCheck, Disc3, Headphones, ReceiptText, Activity, Cloud, ShieldAlert, FlaskConical, Sparkles } from "lucide-react";
import MusicAdmin from "@/components/dashboard/MusicAdmin";
import PayFastAuditLog from "@/components/dashboard/PayFastAuditLog";
import PlaybackAuditLog from "@/components/dashboard/PlaybackAuditLog";
import ReleaseClicksPanel from "@/components/dashboard/ReleaseClicksPanel";
import SecurityEventsPanel from "@/components/dashboard/SecurityEventsPanel";
import SecurityAlertsPanel from "@/components/dashboard/SecurityAlertsPanel";
import SecurityDeliveryMetrics from "@/components/dashboard/SecurityDeliveryMetrics";
import SecurityMetaRuleCharts from "@/components/dashboard/SecurityMetaRuleCharts";
import SecurityAuditLogViewer from "@/components/dashboard/SecurityAuditLogViewer";
import SecurityDailyDigestRunner from "@/components/dashboard/SecurityDailyDigestRunner";
import SecurityHashVerifier from "@/components/dashboard/SecurityHashVerifier";
import SecurityAuditTimeline from "@/components/dashboard/SecurityAuditTimeline";
import SecurityScheduledExports from "@/components/dashboard/SecurityScheduledExports";
import WorkerPlaybackTest from "@/components/dashboard/WorkerPlaybackTest";

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
import KnowledgeVault from "@/components/dashboard/KnowledgeVault";
import ReleasesManager from "@/components/dashboard/ReleasesManager";
import ReleaseCountdownAdmin from "@/components/dashboard/ReleaseCountdownAdmin";
import DailyBriefing from "@/components/dashboard/DailyBriefing";
import { Target } from "lucide-react";

const DESKS = ["Decide", "Foundation", "Grow", "Create", "Protect"] as const;

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, desk: "Decide" },
  { key: "briefing", label: "Daily Briefing", icon: Sparkles, desk: "Decide" },
  { key: "command", label: "Social Vault", icon: ShieldCheck, desk: "Decide" },
  { key: "content", label: "Content", icon: Film, desk: "Decide" },
  { key: "vault", label: "Knowledge Vault", icon: BookLock, desk: "Foundation" },
  { key: "ceo", label: "CEO Diary", icon: BookOpen, desk: "Foundation" },
  { key: "notepad", label: "Notepad", icon: NotebookPen, desk: "Foundation" },
  { key: "contracts", label: "Contracts", icon: FileText, desk: "Foundation" },
  { key: "artists", label: "Artists", icon: Users, desk: "Grow" },
  { key: "scorecard", label: "Scorecard", icon: Star, desk: "Grow" },
  { key: "revenue", label: "Revenue", icon: DollarSign, desk: "Grow" },
  { key: "betting", label: "AI Betting", icon: Target, desk: "Grow" },
  { key: "cloudclicks", label: "Cloud Clicks", icon: Cloud, desk: "Grow" },
  { key: "releases", label: "Releases", icon: Disc3, desk: "Create" },
  { key: "ideas", label: "Ideas", icon: Lightbulb, desk: "Create" },
  { key: "music", label: "Music Admin", icon: Headphones, desk: "Create" },
  { key: "payfast", label: "PayFast Log", icon: ReceiptText, desk: "Protect" },
  { key: "playback", label: "Playback Log", icon: Activity, desk: "Protect" },
  { key: "workertest", label: "Worker Test", icon: FlaskConical, desk: "Protect" },
  { key: "security", label: "Security", icon: ShieldAlert, desk: "Protect" },
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
                <p className="text-sm uppercase tracking-widest text-primary">S2KDOTZA · Private</p>
              </div>
              <h1 className="text-3xl md:text-5xl font-display font-bold">The Workspace</h1>

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

        {/* Desks */}
        <div className="mt-8 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {DESKS.map((desk) => {
            const deskTabs = TABS.filter((t) => t.desk === desk);
            const isActiveDesk = deskTabs.some((t) => t.key === tab);
            return (
              <div
                key={desk}
                className={`rounded-2xl border p-4 transition-all duration-300 ${
                  isActiveDesk
                    ? "border-primary/50 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_8px_30px_-12px_hsl(var(--primary)/0.45)]"
                    : "border-border bg-card/40 hover:border-border/80"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${isActiveDesk ? "bg-primary" : "bg-primary/40"}`} />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{desk}</p>
                  <span className="flex-1 h-px bg-border/70" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {deskTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
                        tab === t.key
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                          : "border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <t.icon size={12} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
            {tab === "briefing" && <DailyBriefing />}
            {tab === "command" && <AICommandCentre />}
            {tab === "vault" && <KnowledgeVault />}
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
            {tab === "workertest" && <WorkerPlaybackTest />}
            {tab === "cloudclicks" && <ReleaseClicksPanel />}
            {tab === "security" && (
              <div className="space-y-4">
                <SecurityEventsPanel />
                <SecurityDeliveryMetrics />
                <SecurityMetaRuleCharts />
                <SecurityAlertsPanel />
                <SecurityDailyDigestRunner />
                <SecurityHashVerifier />
                <SecurityAuditTimeline />
                <SecurityScheduledExports />
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
