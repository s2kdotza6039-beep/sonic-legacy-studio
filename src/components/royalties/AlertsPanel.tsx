import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  status: string;
  action_required: string | null;
  created_at: string;
}

const AlertsPanel = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("royalty_alerts").select("*").eq("status", "open").order("created_at", { ascending: false });
    setAlerts((data as Alert[]) || []);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    // Auto-generate alerts based on song data
    const { data: songs } = await supabase.from("songs").select("*");
    const { data: territories } = await supabase.from("territory_data").select("*");
    const newAlerts: { alert_type: string; severity: string; message: string; song_id?: string; action_required: string }[] = [];

    (songs || []).forEach((s: any) => {
      if (!s.registered_capasso) newAlerts.push({ alert_type: "missing_registration", severity: "critical", message: `"${s.title}" not registered with CAPASSO`, song_id: s.id, action_required: "Register with CAPASSO immediately" });
      if (!s.registered_samro) newAlerts.push({ alert_type: "missing_registration", severity: "critical", message: `"${s.title}" not registered with SAMRO`, song_id: s.id, action_required: "Register with SAMRO immediately" });
      if (Number(s.streams) > 100000 && Number(s.actual_publishing) === 0) newAlerts.push({ alert_type: "registration_issue", severity: "critical", message: `"${s.title}" has ${Number(s.streams).toLocaleString()} streams but R0 publishing`, song_id: s.id, action_required: "Investigate registration and collection" });
      if (Number(s.expected_publishing) > 0 && Number(s.actual_publishing) > 0) {
        const diff = (Number(s.expected_publishing) - Number(s.actual_publishing)) / Number(s.expected_publishing);
        if (diff > 0.3) newAlerts.push({ alert_type: "underpayment", severity: "warning", message: `"${s.title}" actual is ${(diff * 100).toFixed(0)}% below expected`, song_id: s.id, action_required: "Audit royalty statements" });
      }
      if (!s.isrc) newAlerts.push({ alert_type: "missing_metadata", severity: "warning", message: `"${s.title}" missing ISRC code`, song_id: s.id, action_required: "Add ISRC metadata" });
      if (!s.iswc) newAlerts.push({ alert_type: "missing_metadata", severity: "warning", message: `"${s.title}" missing ISWC code`, song_id: s.id, action_required: "Add ISWC metadata" });
    });

    // Territory alerts
    const countryAgg: Record<string, { streams: number; revenue: number }> = {};
    (territories || []).forEach((t: any) => {
      if (!countryAgg[t.country]) countryAgg[t.country] = { streams: 0, revenue: 0 };
      countryAgg[t.country].streams += Number(t.streams);
      countryAgg[t.country].revenue += Number(t.actual_revenue);
    });
    Object.entries(countryAgg).forEach(([country, d]) => {
      if (d.streams > 0 && d.revenue === 0) newAlerts.push({ alert_type: "missing_international", severity: "warning", message: `${country}: ${d.streams.toLocaleString()} streams but no revenue collected`, action_required: "Find sub-publisher for this territory" });
    });

    // Clear old open alerts and insert new ones
    await supabase.from("royalty_alerts").delete().eq("status", "open");
    if (newAlerts.length > 0) {
      await supabase.from("royalty_alerts").insert(newAlerts);
    }

    toast({ title: "Scan complete", description: `${newAlerts.length} alerts generated` });
    setScanning(false);
    load();
  };

  const resolve = async (id: string) => {
    await supabase.from("royalty_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-yellow-400" />
          <h3 className="text-sm uppercase tracking-widest font-bold">Royalty Alerts</h3>
          {alerts.length > 0 && <span className="bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full">{alerts.length}</span>}
        </div>
        <Button size="sm" variant="outline" onClick={runScan} disabled={scanning} className="gap-1">
          <RefreshCw size={14} className={scanning ? "animate-spin" : ""} /> Scan
        </Button>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {alerts.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">No open alerts. Run a scan to check.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="p-4 flex items-start gap-3">
            <AlertTriangle size={14} className={a.severity === "critical" ? "text-destructive mt-0.5" : "text-yellow-400 mt-0.5"} />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{a.message}</p>
              {a.action_required && <p className="text-xs text-muted-foreground mt-1">→ {a.action_required}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => resolve(a.id)}><CheckCircle size={14} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsPanel;
