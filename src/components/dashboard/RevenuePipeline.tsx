import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Deal {
  id: string;
  client_name: string;
  deal_title: string;
  amount: number;
  stage: string;
  notes: string | null;
  closed_at?: string | null;
  created_at: string;

}

const STAGES = ["Lead", "Contacted", "Offer Sent", "Negotiation", "Closed"];

const stageColor: Record<string, string> = {
  Lead: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Contacted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Offer Sent": "bg-primary/20 text-primary border-primary/30",
  Negotiation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Closed: "bg-green-500/20 text-green-400 border-green-500/30",
};

const RevenuePipeline = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_name: "", deal_title: "", amount: "", notes: "" });
  const [view, setView] = useState<"active" | "history">("active");

  const { toast } = useToast();

  const fetchDeals = async () => {
    const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    if (data) setDeals(data as Deal[]);
  };

  useEffect(() => {
    fetchDeals();
    const channel = supabase
      .channel("revenue-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, fetchDeals)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAdd = async () => {
    if (!form.client_name.trim() || !form.deal_title.trim()) return;
    const { error } = await supabase.from("deals").insert({
      client_name: form.client_name, deal_title: form.deal_title,
      amount: parseFloat(form.amount) || 0, notes: form.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setForm({ client_name: "", deal_title: "", amount: "", notes: "" });
    setShowForm(false);
    toast({ title: "Deal added" });
  };

  const updateStage = async (id: string, stage: string) => {
    const updates: Record<string, unknown> = { stage };
    if (stage === "Closed") updates.closed_at = new Date().toISOString();
    await supabase.from("deals").update(updates).eq("id", id);
  };

  const totalPipeline = deals.filter((d) => d.stage !== "Closed").reduce((s, d) => s + Number(d.amount), 0);
  const totalClosed = deals.filter((d) => d.stage === "Closed").reduce((s, d) => s + Number(d.amount), 0);

  const isHistory = (d: Deal) => {
    if (d.stage !== "Closed") return false;
    const ts = new Date(d.closed_at || d.created_at).getTime();
    return Date.now() - ts > 24 * 60 * 60 * 1000;
  };
  const historyDeals = deals.filter(isHistory);
  const activeDeals = deals.filter((d) => !isHistory(d));
  const shownDeals = view === "active" ? activeDeals : historyDeals;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="font-display font-bold text-lg">Revenue Pipeline</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-border rounded-full p-0.5">
            <button
              onClick={() => setView("active")}
              className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition-colors ${view === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Active ({activeDeals.length})
            </button>
            <button
              onClick={() => setView("history")}
              className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition-colors ${view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              History ({historyDeals.length})
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
            {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Deal"}
          </button>
        </div>
      </div>


      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-border bg-secondary/30 p-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Pipeline</span>
          <p className="text-lg font-display font-bold text-primary">R {totalPipeline.toLocaleString()}</p>
        </div>
        <div className="border border-border bg-secondary/30 p-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Closed</span>
          <p className="text-lg font-display font-bold text-green-400">R {totalClosed.toLocaleString()}</p>
        </div>
      </div>

      {showForm && (
        <div className="border border-border bg-secondary/30 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Client Name *" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
            <input placeholder="Deal Title *" value={form.deal_title} onChange={(e) => setForm({ ...form, deal_title: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          </div>
          <input placeholder="Amount (R)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none" rows={2} />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-6 py-2 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">Add</button>
        </div>
      )}

      <div className="space-y-2">
        {shownDeals.length === 0 && (
          <p className="text-sm text-muted-foreground">{view === "active" ? "No active deals yet." : "No archived deals yet."}</p>
        )}
        {shownDeals.map((d) => (

          <div key={d.id} className="border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm">{d.deal_title}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>{d.client_name}</span>
                <span className="font-semibold">R {Number(d.amount).toLocaleString()}</span>
              </div>
            </div>
            <select
              value={d.stage}
              onChange={(e) => updateStage(d.id, e.target.value)}
              className={`text-xs px-3 py-1 border rounded-sm bg-transparent cursor-pointer outline-none ${stageColor[d.stage] || "border-border"}`}
            >
              {STAGES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevenuePipeline;
