import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Film, DollarSign, Clock } from "lucide-react";

interface Metrics {
  totalArtistsThisWeek: number;
  contentPostedToday: number;
  revenueThisMonth: number;
  pendingLeads: number;
}

const MetricsPanel = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalArtistsThisWeek: 0,
    contentPostedToday: 0,
    revenueThisMonth: 0,
    pendingLeads: 0,
  });

  const fetchMetrics = async () => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [artists, content, revenue, leads] = await Promise.all([
      supabase.from("artists").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      supabase.from("content_posts").select("id", { count: "exact", head: true }).gte("posted_at", startOfDay.toISOString()),
      supabase.from("deals").select("amount").eq("stage", "Closed").gte("closed_at", startOfMonth.toISOString()),
      supabase.from("deals").select("id", { count: "exact", head: true }).in("stage", ["Lead", "Contacted", "Offer Sent", "Negotiation"]),
    ]);

    const totalRevenue = (revenue.data || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    setMetrics({
      totalArtistsThisWeek: artists.count || 0,
      contentPostedToday: content.count || 0,
      revenueThisMonth: totalRevenue,
      pendingLeads: leads.count || 0,
    });
  };

  useEffect(() => {
    fetchMetrics();

    const channel = supabase
      .channel("metrics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "artists" }, fetchMetrics)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_posts" }, fetchMetrics)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, fetchMetrics)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { label: "Artists This Week", value: metrics.totalArtistsThisWeek, icon: Users, color: "text-primary" },
    { label: "Content Today", value: metrics.contentPostedToday, icon: Film, color: "text-primary" },
    { label: "Revenue (Month)", value: `R ${metrics.revenueThisMonth.toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Pending Leads", value: metrics.pendingLeads, icon: Clock, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <card.icon size={16} className={card.color} />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-display font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default MetricsPanel;
