import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Star, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Scorecard {
  id: string;
  artist_name: string;
  review_month: string;
  discipline: number;
  music_output: number;
  live_performance: number;
  content_brand: number;
  audience_growth: number;
  business_cooperation: number;
  total_score: number;
  tier: string;
}

const tierColor = (tier: string) => {
  switch (tier) {
    case "Flagship": return "bg-primary text-primary-foreground";
    case "Core Roster": return "bg-green-600 text-white";
    case "Development": return "bg-yellow-600 text-white";
    case "Probation": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const CATEGORIES = [
  { key: "discipline", label: "Discipline", max: 20 },
  { key: "music_output", label: "Music Output", max: 25 },
  { key: "live_performance", label: "Live Performance", max: 20 },
  { key: "content_brand", label: "Content & Brand", max: 15 },
  { key: "audience_growth", label: "Audience Growth", max: 10 },
  { key: "business_cooperation", label: "Business Cooperation", max: 10 },
] as const;

type FormState = {
  artist_name: string;
  review_month: string;
  discipline: string;
  music_output: string;
  live_performance: string;
  content_brand: string;
  audience_growth: string;
  business_cooperation: string;
};

const emptyForm = (month: string): FormState => ({
  artist_name: "", review_month: month, discipline: "", music_output: "", live_performance: "", content_brand: "", audience_growth: "", business_cooperation: "",
});

const scorecardToForm = (c: Scorecard): FormState => ({
  artist_name: c.artist_name,
  review_month: c.review_month,
  discipline: String(c.discipline),
  music_output: String(c.music_output),
  live_performance: String(c.live_performance),
  content_brand: String(c.content_brand),
  audience_growth: String(c.audience_growth),
  business_cooperation: String(c.business_cooperation),
});

const ArtistScorecard = () => {
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState<FormState>(emptyForm(defaultMonth));

  const load = async () => {
    const { data } = await supabase
      .from("artist_scorecards")
      .select("*")
      .order("review_month", { ascending: false })
      .order("total_score", { ascending: false });
    setCards((data as Scorecard[]) || []);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(defaultMonth));
    setOpen(true);
  };

  const openEdit = (c: Scorecard) => {
    setEditingId(c.id);
    setForm(scorecardToForm(c));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.artist_name.trim()) {
      toast({ title: "Artist name required", variant: "destructive" });
      return;
    }
    const payload = {
      artist_name: form.artist_name,
      review_month: form.review_month,
      discipline: Math.min(Number(form.discipline) || 0, 20),
      music_output: Math.min(Number(form.music_output) || 0, 25),
      live_performance: Math.min(Number(form.live_performance) || 0, 20),
      content_brand: Math.min(Number(form.content_brand) || 0, 15),
      audience_growth: Math.min(Number(form.audience_growth) || 0, 10),
      business_cooperation: Math.min(Number(form.business_cooperation) || 0, 10),
    };

    const { error } = editingId
      ? await supabase.from("artist_scorecards").update(payload).eq("id", editingId)
      : await supabase.from("artist_scorecards").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Scorecard updated" : "Scorecard added" });
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm(defaultMonth));
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("artist_scorecards").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Scorecard deleted" });
    load();
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-primary" />
          <h3 className="text-sm uppercase tracking-widest font-bold">Artist Scorecard</h3>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1" onClick={openAdd}><Plus size={14} /> Score</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? "Edit Scorecard" : "Score Artist"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Artist Name" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} />
              <Input placeholder="Review Month (e.g. 2026-04)" value={form.review_month} onChange={(e) => setForm({ ...form, review_month: e.target.value })} />
              {CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground w-36 shrink-0">
                    {cat.label} <span className="text-primary">/{cat.max}</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={cat.max}
                    placeholder={`0-${cat.max}`}
                    value={form[cat.key]}
                    onChange={(e) => setForm({ ...form, [cat.key]: e.target.value })}
                    className="w-24"
                  />
                </div>
              ))}
              <Button onClick={handleSave} className="w-full">{editingId ? "Update Scorecard" : "Save Scorecard"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artist</TableHead>
              <TableHead>Month</TableHead>
              {CATEGORIES.map((c) => (
                <TableHead key={c.key} className="text-center text-[10px]">{c.label.split(" ")[0]}<br /><span className="text-muted-foreground">/{c.max}</span></TableHead>
              ))}
              <TableHead className="text-center">Total</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No scorecards yet</TableCell></TableRow>
            )}
            {cards.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.artist_name}</TableCell>
                <TableCell className="text-muted-foreground">{c.review_month}</TableCell>
                {CATEGORIES.map((cat) => (
                  <TableCell key={cat.key} className="text-center">
                    {c[cat.key as keyof Scorecard] as number}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold">{c.total_score}/100</TableCell>
                <TableCell>
                  <Badge className={tierColor(c.tier)}>{c.tier}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                      <Pencil size={13} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 size={13} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete scorecard?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the scorecard for <strong>{c.artist_name}</strong> ({c.review_month}).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ArtistScorecard;
