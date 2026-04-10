import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, Trash2, RefreshCw } from "lucide-react";

const CATEGORIES = ["Software", "Streaming", "Licensing", "Insurance", "Hosting", "Marketing", "Other"];

const SubscriptionsTracker = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ service_name: "", description: "", cost: "", billing_cycle: "monthly", start_date: "", expiry_date: "", auto_renew: false, reminder_days: "7", category: "Software", notes: "" });
  const { toast } = useToast();

  const fetchSubs = async () => {
    const { data } = await supabase.from("subscriptions").select("*").order("expiry_date", { ascending: true });
    if (data) setSubs(data);
  };

  useEffect(() => { fetchSubs(); }, []);

  const handleAdd = async () => {
    if (!form.service_name.trim()) return;
    await supabase.from("subscriptions").insert({
      ...form,
      cost: Number(form.cost) || 0,
      reminder_days: Number(form.reminder_days) || 7,
      start_date: form.start_date || null,
      expiry_date: form.expiry_date || null,
    });
    toast({ title: "Subscription added" });
    setForm({ service_name: "", description: "", cost: "", billing_cycle: "monthly", start_date: "", expiry_date: "", auto_renew: false, reminder_days: "7", category: "Software", notes: "" });
    setOpen(false);
    fetchSubs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("subscriptions").delete().eq("id", id);
    fetchSubs();
  };

  const daysUntilExpiry = (date: string | null) => {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const totalMonthlyCost = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const cost = Number(s.cost);
    if (s.billing_cycle === "yearly") return sum + cost / 12;
    if (s.billing_cycle === "weekly") return sum + cost * 4;
    return sum + cost;
  }, 0);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Monthly cost: </span>
          <span className="font-bold text-primary">R{totalMonthlyCost.toFixed(0)}</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="text-xs gap-1"><Plus size={12} /> Add Subscription</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Subscription</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Service Name *" value={form.service_name} onChange={e => setForm(p => ({ ...p, service_name: e.target.value }))} />
              <Input placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Cost (R)" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                <Select value={form.billing_cycle} onValueChange={v => setForm(p => ({ ...p, billing_cycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">Start Date</label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">Expiry Date</label><Input type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="Remind X days before" value={form.reminder_days} onChange={e => setForm(p => ({ ...p, reminder_days: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_renew} onChange={e => setForm(p => ({ ...p, auto_renew: e.target.checked }))} /> Auto-renew
              </label>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleAdd} className="w-full">Add Subscription</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {subs.map(s => {
          const days = daysUntilExpiry(s.expiry_date);
          const expiring = days !== null && days <= (s.reminder_days || 7) && days >= 0;
          const expired = days !== null && days < 0;

          return (
            <div key={s.id} className={`border p-3 group ${expired ? "border-destructive/50 bg-destructive/5" : expiring ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{s.service_name}</p>
                    {s.auto_renew && <RefreshCw size={10} className="text-green-400" />}
                    {expiring && <AlertTriangle size={12} className="text-yellow-400" />}
                    {expired && <span className="text-xs text-destructive">EXPIRED</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.category} · R{Number(s.cost).toLocaleString()}/{s.billing_cycle}</p>
                  {s.expiry_date && <p className="text-xs text-muted-foreground">Expires: {s.expiry_date}{days !== null ? ` (${days > 0 ? `${days}d left` : `${Math.abs(days)}d overdue`})` : ""}</p>}
                </div>
                <button onClick={() => handleDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
        {subs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No subscriptions tracked yet.</p>}
      </div>
    </div>
  );
};

export default SubscriptionsTracker;
