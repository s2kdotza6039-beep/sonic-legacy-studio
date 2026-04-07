import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, Shield, AlertTriangle, Zap, Brain, BarChart3, DollarSign, Filter, Layers } from "lucide-react";

const systemSections = [
  {
    key: "purpose",
    label: "System Purpose",
    icon: Brain,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">Automatically:</p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Fetch tomorrow's matches</li>
          <li className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Analyze probabilities</li>
          <li className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Select high-confidence games</li>
          <li className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Generate 5–10 structured betting slips daily</li>
        </ul>
      </div>
    ),
  },
  {
    key: "data",
    label: "Data Input",
    icon: BarChart3,
    content: (
      <div className="space-y-4">
        <h4 className="text-xs uppercase tracking-widest text-primary">Daily Process</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Pull all matches for next 24 hours</li>
          <li>• Filter to top leagues only</li>
          <li>• Matches with available odds</li>
          <li>• <strong className="text-foreground">Limit:</strong> Select 10–15 matches maximum</li>
        </ul>
      </div>
    ),
  },
  {
    key: "analysis",
    label: "Analysis Engine",
    icon: TrendingUp,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-primary">Team Strength</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Attack rating</li>
              <li>• Defense rating</li>
              <li>• Home vs Away performance</li>
            </ul>
          </div>
          <div className="border border-border p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-primary">Form</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Last 5 matches</li>
              <li>• Goals scored / conceded</li>
            </ul>
          </div>
        </div>
        <div className="border border-border p-4 space-y-2">
          <h4 className="text-xs uppercase tracking-widest text-primary">Output Per Match</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
            <span>Win Probability (%)</span>
            <span>Draw Probability (%)</span>
            <span>Lose Probability (%)</span>
            <span>Over 1.5 Probability (%)</span>
            <span>Over 2.5 Probability (%)</span>
            <span>BTTS Probability (%)</span>
            <span>Confidence Score</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "filter",
    label: "Filter Rules",
    icon: Filter,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Only keep matches where <Badge variant="outline">Confidence = HIGH</Badge> AND one of:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm"><span className="text-green-400">✔</span> Win Probability &gt; 60%</div>
          <div className="flex items-center gap-2 text-sm"><span className="text-green-400">✔</span> Over 1.5 &gt; 75%</div>
          <div className="flex items-center gap-2 text-sm"><span className="text-green-400">✔</span> BTTS &gt; 65%</div>
        </div>
        <p className="text-xs text-primary">👉 Final selection: 8–12 matches</p>
      </div>
    ),
  },
  {
    key: "core",
    label: "Core Picks",
    icon: Target,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">From filtered matches, choose <strong className="text-foreground">5–6 strongest picks</strong></p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><Shield size={14} className="text-primary" /> Strong home teams → Double Chance or Win</div>
          <div className="flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> High scoring teams → Over 1.5</div>
          <div className="flex items-center gap-2"><Zap size={14} className="text-primary" /> Both teams scoring → BTTS</div>
        </div>
        <p className="text-xs text-primary">👉 These appear in MOST slips</p>
      </div>
    ),
  },
  {
    key: "slips",
    label: "Slip Generator",
    icon: Layers,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Generate <strong className="text-foreground">5–10 slips daily</strong></p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-green-500/30 bg-green-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">SAFE</Badge>
              <span className="text-xs text-muted-foreground">Slip 1–3</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Double Chance</li>
              <li>• Over 1.5 Goals</li>
              <li>• 3–5 matches per slip</li>
              <li>• Mostly CORE picks</li>
            </ul>
            <p className="text-xs text-green-400">High probability, Low risk</p>
          </div>
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">BALANCED</Badge>
              <span className="text-xs text-muted-foreground">Slip 4–7</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Win bets</li>
              <li>• Over 2.5 / BTTS</li>
              <li>• 4–6 matches</li>
              <li>• CORE + 1–2 variations</li>
            </ul>
            <p className="text-xs text-yellow-400">Medium risk, Better payout</p>
          </div>
          <div className="border border-red-500/30 bg-red-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">HIGH RISK</Badge>
              <span className="text-xs text-muted-foreground">Slip 8–10</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Correct score (optional)</li>
              <li>• Underdog win</li>
              <li>• Over 3.5</li>
              <li>• 2–4 matches</li>
            </ul>
            <p className="text-xs text-red-400">High payout (optional use)</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "variation",
    label: "Variation Logic",
    icon: Zap,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Each slip must:</p>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Keep 3–4 CORE picks the same</li>
          <li>• Change 1–2 selections</li>
        </ul>
        <div className="border border-border p-4 space-y-3">
          <h4 className="text-xs uppercase tracking-widest text-primary">Example</h4>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p className="text-foreground font-medium">CORE:</p>
            <p>Team A → Over 1.5 | Team B → Double Chance</p>
            <p className="text-foreground font-medium mt-2">Slip 1:</p>
            <p>+ Team C Win</p>
            <p className="text-foreground font-medium">Slip 2:</p>
            <p>+ Team C Over 2.5</p>
            <p className="text-foreground font-medium">Slip 3:</p>
            <p>+ Team D BTTS</p>
          </div>
        </div>
        <p className="text-xs text-primary">👉 This spreads probability across slips</p>
      </div>
    ),
  },
  {
    key: "patterns",
    label: "Pattern Rules",
    icon: AlertTriangle,
    content: (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">IF</span> team always scores → use <Badge variant="outline">Over 1.5</Badge></div>
        <div className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">IF</span> team always concedes → use <Badge variant="outline">BTTS</Badge></div>
        <div className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">IF</span> strong at home → use <Badge variant="outline">Win / DC</Badge></div>
        <div className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">IF</span> late goals trend → use <Badge variant="outline">Over markets</Badge></div>
      </div>
    ),
  },
  {
    key: "bankroll",
    label: "Bankroll",
    icon: DollarSign,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Divide budget evenly across slips:</p>
        <div className="border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Budget:</span><span>R100</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Slips:</span><span>10</span></div>
          <div className="flex justify-between border-t border-border pt-2"><span className="text-primary font-medium">Stake per slip:</span><span className="text-primary font-medium">R10</span></div>
        </div>
      </div>
    ),
  },
];

const BettingSystem = () => {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Target size={20} className="text-primary" />
            <div>
              <CardTitle className="text-lg">⚽ AI Betting System — S2K / Personal Engine</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Probability-based • Structured • Daily</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="border border-border p-3">
              <p className="text-2xl font-bold text-primary">5–10</p>
              <p className="text-xs text-muted-foreground">Daily Slips</p>
            </div>
            <div className="border border-border p-3">
              <p className="text-2xl font-bold text-primary">HIGH</p>
              <p className="text-xs text-muted-foreground">Confidence Only</p>
            </div>
            <div className="border border-border p-3">
              <p className="text-2xl font-bold text-primary">5–6</p>
              <p className="text-xs text-muted-foreground">Core Picks</p>
            </div>
            <div className="border border-border p-3">
              <p className="text-2xl font-bold text-primary">0%</p>
              <p className="text-xs text-muted-foreground">Random Picks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="purpose" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {systemSections.map((s) => (
            <button
              key={s.key}
              value={s.key}
              className="flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors data-[state=active]:border-primary data-[state=active]:text-primary"
              // We'll use a custom tab approach below
            >
              <s.icon size={12} /> {s.label}
            </button>
          ))}
        </TabsList>
      </Tabs>

      {/* Using a simple state-based approach matching the dashboard pattern */}
      <BettingTabs />

      {/* Final Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">🔥 System Result</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2"><span className="text-green-400">✔</span> Reduces risk</div>
            <div className="flex items-center gap-2"><span className="text-green-400">✔</span> Uses probability</div>
            <div className="flex items-center gap-2"><span className="text-green-400">✔</span> Structured strategy</div>
            <div className="flex items-center gap-2"><span className="text-green-400">✔</span> Works daily</div>
          </div>
          <div className="mt-4 pt-3 border-t border-primary/20 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Final Logic Rules:</p>
            <p>No random picks • No emotional betting • Only HIGH confidence • Multiple slips • Always vary 1–2 selections</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Internal tabbed component
import { useState } from "react";

const BettingTabs = () => {
  const [activeTab, setActiveTab] = useState("purpose");

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {systemSections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-widest border transition-colors ${
              activeTab === s.key
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            }`}
          >
            <s.icon size={12} /> {s.label}
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          {systemSections.find((s) => s.key === activeTab)?.content}
        </CardContent>
      </Card>
    </div>
  );
};

export default BettingSystem;
