import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const ArtistScorecard = () => {
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({
    artist_name: "",
    review_month: defaultMonth,
    discipline: "",
    music_output: "",
    live_performance: "",
    content_brand: "",
    audience_growth: "",
    business_cooperation: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("artist_scorecards")
      .select("*")
      .order("review_month", { ascending: false })
      .order("total_score", { ascending: false });
    setCards((data as Scorecard[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.artist_name.trim()) {
      toast({ title: "Artist name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("artist_scorecards").insert({
      artist_name: form.artist_name,
      review_month: form.review_month,
      discipline: Math.min(Number(form.discipline) || 0, 20),
      music_output: Math.min(Number(form.music_output) || 0, 25),
      live_performance: Math.min(Number(form.live_performance) || 0, 20),
      content_brand: Math.min(Number(form.content_brand) || 0, 15),
      audience_growth: Math.min(Number(form.audience_growth) || 0, 10),
      business_cooperation: Math.min(Number(form.business_cooperation) || 0, 10),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Scorecard added" });
    setOpen(false);
    setForm({ artist_name: "", review_month: defaultMonth, discipline: "", music_output: "", live_performance: "", content_brand: "", audience_growth: "", business_cooperation: "" });
    load();
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-primary" />
          <h3 className="text-sm uppercase tracking-widest font-bold">Artist Scorecard</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Score</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Score Artist</DialogTitle></DialogHeader>
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
              <Button onClick={handleAdd} className="w-full">Save Scorecard</Button>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No scorecards yet</TableCell></TableRow>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ArtistScorecard;
