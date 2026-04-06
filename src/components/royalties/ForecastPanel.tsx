import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Forecast {
  threeMonth: string;
  twelveMonth: string;
  topSongs: string[];
  declingSongs: string[];
  insights: string;
}

const ForecastPanel = () => {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const [{ data: income }, { data: songs }] = await Promise.all([
        supabase.from("royalty_income").select("*"),
        supabase.from("songs").select("*"),
      ]);

      const { data, error } = await supabase.functions.invoke("royalty-forecast", {
        body: { income: income || [], songs: songs || [] },
      });

      if (error) throw error;
      setForecast(data);
    } catch (e: any) {
      toast({ title: "Forecast failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <h3 className="text-sm uppercase tracking-widest font-bold">AI Revenue Forecast</h3>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="gap-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
          {loading ? "Analyzing..." : "Generate"}
        </Button>
      </div>
      <div className="p-4">
        {!forecast && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Click "Generate" to get AI-powered revenue predictions based on your data.</p>
        )}
        {forecast && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/30 p-3 border border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">3-Month Forecast</p>
                <p className="text-lg font-bold font-display">{forecast.threeMonth}</p>
              </div>
              <div className="bg-secondary/30 p-3 border border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">12-Month Forecast</p>
                <p className="text-lg font-bold font-display">{forecast.twelveMonth}</p>
              </div>
            </div>
            {forecast.topSongs.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Top Performing</p>
                {forecast.topSongs.map((s, i) => (
                  <p key={i} className="text-sm">🔥 {s}</p>
                ))}
              </div>
            )}
            {forecast.declingSongs.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Declining</p>
                {forecast.declingSongs.map((s, i) => (
                  <p key={i} className="text-sm">📉 {s}</p>
                ))}
              </div>
            )}
            {forecast.insights && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Insights</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{forecast.insights}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastPanel;
