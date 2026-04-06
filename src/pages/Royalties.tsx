import Layout from "@/components/Layout";
import { Lock, LogOut, User, Music } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import RevenueOverview from "@/components/royalties/RevenueOverview";
import IncomeTracker from "@/components/royalties/IncomeTracker";
import SongTracker from "@/components/royalties/SongTracker";
import TerritoryAnalysis from "@/components/royalties/TerritoryAnalysis";
import AlertsPanel from "@/components/royalties/AlertsPanel";
import ForecastPanel from "@/components/royalties/ForecastPanel";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "songs", label: "Songs" },
  { key: "territories", label: "Territories" },
  { key: "alerts", label: "Alerts" },
  { key: "forecast", label: "Forecast" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const Royalties = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("overview");

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/");
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Music size={20} className="text-primary" />
                <p className="text-sm uppercase tracking-widest text-primary">Royalty Audit</p>
              </div>
              <h1 className="text-3xl md:text-5xl font-display font-bold">Royalty Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-2">Data → Insight → Action → Recovered Revenue</p>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                ← Team Dashboard
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

      <div className="section-padding max-w-6xl mx-auto">
        <RevenueOverview />

        {/* Tabs */}
        <div className="flex gap-2 mt-8 mb-6 border-b border-border pb-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-xs uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {tab === "overview" && (
              <div className="space-y-6">
                <SongTracker />
                <IncomeTracker />
              </div>
            )}
            {tab === "income" && <IncomeTracker />}
            {tab === "songs" && <SongTracker />}
            {tab === "territories" && <TerritoryAnalysis />}
            {tab === "alerts" && <AlertsPanel />}
            {tab === "forecast" && <ForecastPanel />}
          </div>
          <div className="space-y-6">
            {tab !== "alerts" && <AlertsPanel />}
            {tab !== "forecast" && <ForecastPanel />}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Royalties;
