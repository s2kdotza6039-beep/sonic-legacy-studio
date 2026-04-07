import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, Shield, AlertTriangle, RefreshCw, DollarSign, TrendingUp, ChevronDown, ChevronUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Selection {
  match_id: number;
  home: string;
  away: string;
  market: string;
  probability: number;
  is_core: boolean;
  kickoff?: string;
  league?: string;
}

interface Slip {
  id: number;
  category: "SAFE" | "BALANCED" | "HIGH_RISK" | "DAILY_SAFE";
  stake: number;
  estimated_odds: number;
  potential_return: number;
  selections: Selection[];
}

interface Match {
  id: number;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  win_prob: number;
  draw_prob: number;
  lose_prob: number;
  over15_prob: number;
  over25_prob: number;
  btts_prob: number;
  confidence: string;
  is_core: boolean;
  pattern: string;
}

interface CorePick {
  match_id: number;
  market: string;
  reason: string;
}

interface SlipData {
  date: string;
  matches: Match[];
  core_picks: CorePick[];
  slips: Slip[];
  bankroll: { budget: number; total_slips: number; stake_per_slip: number };
}

const categoryConfig = {
  DAILY_SAFE: { color: "text-primary", border: "border-primary/40", bg: "bg-primary/10", icon: Shield, label: "🔒 DAILY SAFE" },
  SAFE: { color: "text-primary", border: "border-primary/30", bg: "bg-primary/5", icon: Shield, label: "SAFE" },
  BALANCED: { color: "text-accent-foreground", border: "border-accent/30", bg: "bg-accent/5", icon: TrendingUp, label: "BALANCED" },
  HIGH_RISK: { color: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/5", icon: AlertTriangle, label: "HIGH RISK" },
};

const SlipGeneratorEngine = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState<SlipData | null>(null);
  const [budget, setBudget] = useState("100");
  const [slipCount, setSlipCount] = useState("8");
  const [expandedSlip, setExpandedSlip] = useState<number | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const generate = async () => {
    setLoading(true);
    setData(null);
    setSaved(false);
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-betting-slips", {
        body: { budget: Number(budget), slipCount: Number(slipCount) },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.error);
      setData(result);
      toast({ title: "Slips Generated", description: `${result.slips?.length || 0} slips ready for ${result.date}` });
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveAllSlips = async () => {
    if (!data || !user) return;
    setSaving(true);
    try {
      for (const slip of data.slips) {
        const { data: savedSlip, error: slipError } = await supabase
          .from("betting_slips")
          .insert({
            user_id: user.id,
            slip_number: slip.id,
            category: slip.category,
            stake: slip.stake,
            estimated_odds: slip.estimated_odds,
            potential_return: slip.potential_return,
            match_date: data.date,
          })
          .select()
          .single();

        if (slipError) throw slipError;

        const selections = slip.selections.map((sel) => ({
          slip_id: savedSlip.id,
          home: sel.home,
          away: sel.away,
          market: sel.market,
          probability: sel.probability,
          is_core: sel.is_core,
          kickoff: sel.kickoff || null,
          league: sel.league || null,
        }));

        const { error: selError } = await supabase.from("betting_selections").insert(selections);
        if (selError) throw selError;
      }
      setSaved(true);
      toast({ title: "Slips Saved", description: `${data.slips.length} slips saved to history` });
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <Zap size={16} className="text-primary" /> Slip Generator Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-widest">Budget (R)</label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} className="w-28" type="number" min={10} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-widest">Slips</label>
              <Input value={slipCount} onChange={(e) => setSlipCount(e.target.value)} className="w-20" type="number" min={3} max={10} />
            </div>
            <Button onClick={generate} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {loading ? "Analyzing Matches..." : "Generate Daily Slips"}
            </Button>
          </div>
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-center">
              <div className="border border-border p-2">
                <p className="text-lg font-bold text-primary">{data.matches?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Matches Analyzed</p>
              </div>
              <div className="border border-border p-2">
                <p className="text-lg font-bold text-primary">{data.core_picks?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Core Picks</p>
              </div>
              <div className="border border-border p-2">
                <p className="text-lg font-bold text-primary">{data.slips?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Slips Generated</p>
              </div>
              <div className="border border-border p-2">
                <p className="text-lg font-bold text-primary">R{data.bankroll?.stake_per_slip || 0}</p>
                <p className="text-xs text-muted-foreground">Per Slip</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Match Analysis Toggle */}
          <button onClick={() => setShowMatches(!showMatches)} className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            {showMatches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMatches ? "Hide" : "Show"} Match Analysis ({data.matches?.length || 0} matches)
          </button>

          {showMatches && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.matches?.map((m) => (
                <Card key={m.id} className={m.is_core ? "border-primary/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{m.league} • {m.kickoff}</span>
                      <div className="flex gap-1">
                        {m.is_core && <Badge className="text-[10px]">CORE</Badge>}
                        <Badge variant="outline" className="text-[10px]">{m.confidence}</Badge>
                      </div>
                    </div>
                    <p className="font-medium text-sm">{m.home} vs {m.away}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Win: {m.win_prob}%</span>
                      <span>Draw: {m.draw_prob}%</span>
                      <span>Lose: {m.lose_prob}%</span>
                      <span>O1.5: {m.over15_prob}%</span>
                      <span>O2.5: {m.over25_prob}%</span>
                      <span>BTTS: {m.btts_prob}%</span>
                    </div>
                    <p className="text-xs text-primary mt-2">{m.pattern}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Core Picks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">🎯 Core Picks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.core_picks?.map((cp, i) => {
                  const match = data.matches?.find((m) => m.id === cp.match_id);
                  return (
                    <div key={i} className="flex items-center justify-between border border-primary/20 bg-primary/5 p-3">
                      <div>
                        <span className="text-sm font-medium">{match ? `${match.home} vs ${match.away}` : `Match ${cp.match_id}`}</span>
                        <span className="text-xs text-muted-foreground ml-2">→ {cp.market}</span>
                      </div>
                      <span className="text-xs text-primary">{cp.reason}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Generated Slips */}
          <div className="space-y-3">
            <h3 className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <DollarSign size={14} /> Generated Slips — {data.date}
            </h3>
            {data.slips?.map((slip) => {
              const config = categoryConfig[slip.category] || categoryConfig.SAFE;
              const Icon = config.icon;
              const isExpanded = expandedSlip === slip.id;
              return (
                <Card key={slip.id} className={config.border}>
                  <button onClick={() => setExpandedSlip(isExpanded ? null : slip.id)} className="w-full text-left">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon size={16} className={config.color} />
                          <div>
                            <span className="text-sm font-medium">Slip {slip.id}</span>
                            <Badge variant="outline" className={`ml-2 text-[10px] ${config.color}`}>{config.label}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{slip.selections?.length || 0} picks</span>
                          <span>Odds: {slip.estimated_odds?.toFixed(2)}</span>
                          <span className="text-primary font-medium">R{slip.stake} → R{slip.potential_return?.toFixed(0)}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          {slip.selections?.map((sel, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-1">
                              <div className="flex items-center gap-2">
                                {sel.is_core && <Badge className="text-[10px] py-0">CORE</Badge>}
                                <span>{sel.home} vs {sel.away}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                {sel.league && <span className="text-muted-foreground">{sel.league}</span>}
                                {sel.kickoff && <span className="text-muted-foreground">⏰ {sel.kickoff}</span>}
                                <span className="text-muted-foreground">{sel.market}</span>
                                <span className="text-primary">{sel.probability}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default SlipGeneratorEngine;
