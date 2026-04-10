import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Plane, Trash2 } from "lucide-react";

const STATUSES = ["Planned", "Confirmed", "In Progress", "Completed", "Cancelled"];

const TouringLog = () => {
  const [tours, setTours] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ event_name: "", artist_name: "", venue: "", city: "", country: "South Africa", start_date: "", end_date: "", status: "Planned", budget: "", notes: "" });
  const { toast } = useToast();

  const fetchTours = async () => {
    const { data } = await supabase.from("touring_log").select("*").order("start_date", { ascending: true });
    if (data) setTours(data);
  };

  useEffect(() => { fetchTours(); }, []);

  const handleAdd = async () => {
    if (!form.event_name.trim()) return;
    await supabase.from("touring_log").insert({
      ...form,
      budget: form.budget ? Number(form.budget) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
    toast({ title: "Tour entry added" });
    setForm({ event_name: "", artist_name: "", venue: "", city: "", country: "South Africa", start_date: "", end_date: "", status: "Planned", budget: "", notes: "" });
    setOpen(false);
    fetchTours();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("touring_log").delete().eq("id", id);
    fetchTours();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { Planned: "bg-blue-500/20 text-blue-400", Confirmed: "bg-green-500/20 text-green-400", "In Progress": "bg-yellow-500/20 text-yellow-400", Completed: "bg-primary/20 text-primary", Cancelled: "bg-destructive/20 text-destructive" };
    return map[s] || "bg-secondary text-foreground";
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{tours.length} tour entries</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="text-xs gap-1"><Plus size={12} /> Add Tour</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Tour / Travel Entry</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Event Name *" value={form.event_name} onChange={e => setForm(p => ({ ...p, event_name: e.target.value }))} />
              <Input placeholder="Artist Name" value={form.artist_name} onChange={e => setForm(p => ({ ...p, artist_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Venue" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
                <Input placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <Input placeholder="Country" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">Start Date</label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">End Date</label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="Budget (R)" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
              </div>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleAdd} className="w-full">Add Entry</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {tours.map(t => (
          <div key={t.id} className="border border-border p-3 group">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Plane size={14} className="text-primary" />
                  <p className="font-medium text-sm">{t.event_name}</p>
                  <span className={`text-xs px-1.5 py-0.5 ${statusColor(t.status)}`}>{t.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.artist_name && `${t.artist_name} · `}{t.venue && `${t.venue}, `}{t.city}{t.country ? `, ${t.country}` : ""}
                </p>
                {t.start_date && <p className="text-xs text-muted-foreground">{t.start_date}{t.end_date ? ` → ${t.end_date}` : ""}</p>}
              </div>
              <div className="flex items-center gap-2">
                {t.budget > 0 && <span className="text-xs text-muted-foreground">R{Number(t.budget).toLocaleString()}</span>}
                <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
        {tours.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tour entries yet.</p>}
      </div>
    </div>
  );
};

export default TouringLog;
