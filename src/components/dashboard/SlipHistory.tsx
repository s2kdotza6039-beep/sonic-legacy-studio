import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { History, CheckCircle, XCircle, Clock, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface SavedSlip {
  id: string;
  slip_number: number;
  category: string;
  stake: number;
  estimated_odds: number;
  potential_return: number;
  actual_return: number | null;
  result: string;
  match_date: string;
  created_at: string;
  betting_selections: {
    id: string;
    home: string;
    away: string;
    market: string;
    probability: number;
    is_core: boolean;
    kickoff: string | null;
    league: string | null;
    result: string;
  }[];
}

const resultConfig = {
  pending: { color: "text-muted-foreground", icon: Clock, label: "Pending" },
  won: { color: "text-primary", icon: CheckCircle, label: "Won" },
  lost: { color: "text-destructive", icon: XCircle, label: "Lost" },
};

const SlipHistory = () => {
  const [slips, setSlips] = useState<SavedSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSlip, setExpandedSlip] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSlips = async () => {
    const { data, error } = await supabase
      .from("betting_slips")
      .select("*, betting_selections(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: "Error loading history", description: error.message, variant: "destructive" });
    } else {
      setSlips((data as unknown as SavedSlip[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSlips(); }, []);

  const updateResult = async (slipId: string, result: "won" | "lost", actualReturn?: number) => {
    const { error } = await supabase
      .from("betting_slips")
      .update({ result, actual_return: actualReturn ?? 0 })
      .eq("id", slipId);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Result updated" });
      fetchSlips();
    }
  };

  const updateSelectionResult = async (selectionId: string, result: "won" | "lost", slip: SavedSlip) => {
    const { error } = await supabase
      .from("betting_selections")
      .update({ result })
      .eq("id", selectionId);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-determine slip result: if all selections are resolved, mark slip accordingly
    const updatedSelections = slip.betting_selections.map(s => 
      s.id === selectionId ? { ...s, result } : s
    );
    const allResolved = updatedSelections.every(s => s.result !== "pending");
    if (allResolved) {
      const allWon = updatedSelections.every(s => s.result === "won");
      await updateResult(slip.id, allWon ? "won" : "lost", allWon ? Number(slip.potential_return) : 0);
    } else {
      fetchSlips();
    }
  };

  const stats = {
    total: slips.length,
    won: slips.filter(s => s.result === "won").length,
    lost: slips.filter(s => s.result === "lost").length,
    pending: slips.filter(s => s.result === "pending").length,
    totalStaked: slips.reduce((sum, s) => sum + Number(s.stake), 0),
    totalReturned: slips.filter(s => s.result === "won").reduce((sum, s) => sum + Number(s.actual_return || s.potential_return), 0),
  };
  const winRate = stats.total - stats.pending > 0 ? ((stats.won / (stats.total - stats.pending)) * 100).toFixed(1) : "—";
  const profit = stats.totalReturned - stats.totalStaked;

  // Build win rate trend data grouped by match_date
  const trendData = useMemo(() => {
    const resolved = slips.filter(s => s.result === "won" || s.result === "lost");
    if (resolved.length === 0) return [];

    // Group by match_date
    const byDate: Record<string, { won: number; total: number }> = {};
    resolved
      .sort((a, b) => a.match_date.localeCompare(b.match_date))
      .forEach((s) => {
        if (!byDate[s.match_date]) byDate[s.match_date] = { won: 0, total: 0 };
        byDate[s.match_date].total++;
        if (s.result === "won") byDate[s.match_date].won++;
      });

    let cumulativeWon = 0;
    let cumulativeTotal = 0;
    let cumulativeProfit = 0;

    return Object.entries(byDate).map(([date, { won, total }]) => {
      cumulativeWon += won;
      cumulativeTotal += total;
      const daySlips = resolved.filter(s => s.match_date === date);
      daySlips.forEach(s => {
        cumulativeProfit += s.result === "won" ? Number(s.actual_return || s.potential_return) - Number(s.stake) : -Number(s.stake);
      });
      return {
        date: date.slice(5), // MM-DD
        winRate: Math.round((cumulativeWon / cumulativeTotal) * 100),
        profit: Math.round(cumulativeProfit),
        dayWinRate: Math.round((won / total) * 100),
      };
    });
  }, [slips]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
        <div className="border border-border p-3">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Slips</p>
        </div>
        <div className="border border-border p-3">
          <p className="text-lg font-bold text-primary">{stats.won}</p>
          <p className="text-xs text-muted-foreground">Won</p>
        </div>
        <div className="border border-border p-3">
          <p className="text-lg font-bold text-destructive">{stats.lost}</p>
          <p className="text-xs text-muted-foreground">Lost</p>
        </div>
        <div className="border border-border p-3">
          <p className="text-lg font-bold text-primary">{winRate}%</p>
          <p className="text-xs text-muted-foreground">Win Rate</p>
        </div>
        <div className="border border-border p-3">
          <p className={`text-lg font-bold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>R{profit.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Profit/Loss</p>
        </div>
      </div>

      {/* Win Rate Trend Chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Win Rate & Profit Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="winRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="R" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area yAxisId="left" type="monotone" dataKey="winRate" stroke="hsl(var(--primary))" fill="url(#winRateGrad)" name="Win Rate %" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="profit" stroke="hsl(var(--destructive))" name="Cum. Profit (R)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Slip List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading history...</p>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No saved slips yet. Generate and save slips from the Live Engine.</p>
      ) : (
        <div className="space-y-2">
          {slips.map((slip) => {
            const rc = resultConfig[slip.result as keyof typeof resultConfig] || resultConfig.pending;
            const Icon = rc.icon;
            const isExpanded = expandedSlip === slip.id;
            return (
              <Card key={slip.id} className="border-border">
                <button onClick={() => setExpandedSlip(isExpanded ? null : slip.id)} className="w-full text-left">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={rc.color} />
                        <div>
                          <span className="text-sm font-medium">Slip {slip.slip_number}</span>
                          <Badge variant="outline" className="ml-2 text-[10px]">{slip.category}</Badge>
                          <Badge variant="outline" className={`ml-1 text-[10px] ${rc.color}`}>{rc.label}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{slip.match_date}</span>
                        <span>R{Number(slip.stake)} → R{Number(slip.potential_return).toFixed(0)}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 space-y-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                        {slip.betting_selections?.map((sel) => (
                          <div key={sel.id} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-2">
                              {sel.is_core && <Badge className="text-[10px] py-0">CORE</Badge>}
                              <span>{sel.home} vs {sel.away}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              {sel.league && <span className="text-muted-foreground">{sel.league}</span>}
                              {sel.kickoff && <span className="text-muted-foreground">⏰ {sel.kickoff}</span>}
                              <span className="text-muted-foreground">{sel.market}</span>
                              <span className="text-primary">{Number(sel.probability)}%</span>
                            </div>
                          </div>
                        ))}
                        {slip.result === "pending" && (
                          <div className="flex gap-2 pt-3 border-t border-border">
                            <Button size="sm" variant="outline" className="gap-1 text-primary border-primary/30" onClick={() => updateResult(slip.id, "won", Number(slip.potential_return))}>
                              <CheckCircle size={12} /> Mark Won
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30" onClick={() => updateResult(slip.id, "lost")}>
                              <XCircle size={12} /> Mark Lost
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SlipHistory;
