import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { History, CheckCircle, XCircle, Clock, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

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
