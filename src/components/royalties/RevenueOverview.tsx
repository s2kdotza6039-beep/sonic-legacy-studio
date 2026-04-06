import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";

interface Overview {
  totalMonth: number;
  totalYTD: number;
  publishing: number;
  masters: number;
  growthPct: number;
  outstanding: number;
}

const RevenueOverview = () => {
  const [data, setData] = useState<Overview>({
    totalMonth: 0, totalYTD: 0, publishing: 0, masters: 0, growthPct: 0, outstanding: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
      const yearPrefix = `${now.getFullYear()}-`;

      const { data: all } = await supabase.from("royalty_income").select("*");
      const rows = all || [];

      const monthRows = rows.filter((r) => r.month === currentMonth);
      const prevRows = rows.filter((r) => r.month === prevMonth);
      const ytdRows = rows.filter((r) => r.month.startsWith(yearPrefix));

      const totalMonth = monthRows.reduce((s, r) => s + Number(r.net), 0);
      const totalYTD = ytdRows.reduce((s, r) => s + Number(r.net), 0);
      const prevTotal = prevRows.reduce((s, r) => s + Number(r.net), 0);
      const publishing = monthRows.filter((r) => ["SAMRO", "CAPASSO"].includes(r.source)).reduce((s, r) => s + Number(r.net), 0);
      const masters = monthRows.filter((r) => !["SAMRO", "CAPASSO"].includes(r.source)).reduce((s, r) => s + Number(r.net), 0);
      const outstanding = rows.filter((r) => !r.paid).reduce((s, r) => s + Number(r.net), 0);
      const growthPct = prevTotal > 0 ? ((totalMonth - prevTotal) / prevTotal) * 100 : 0;

      setData({ totalMonth, totalYTD, publishing, masters, growthPct, outstanding });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Total (Month)", value: `R ${data.totalMonth.toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "YTD Revenue", value: `R ${data.totalYTD.toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Publishing", value: `R ${data.publishing.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    { label: "Masters", value: `R ${data.masters.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    { label: "Growth", value: `${data.growthPct >= 0 ? "+" : ""}${data.growthPct.toFixed(0)}%`, icon: data.growthPct >= 0 ? TrendingUp : TrendingDown, color: data.growthPct >= 0 ? "text-green-400" : "text-destructive" },
    { label: "Outstanding", value: `R ${data.outstanding.toLocaleString()}`, icon: Clock, color: "text-yellow-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <c.icon size={14} className={c.color} />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-xl font-display font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
};

export default RevenueOverview;
