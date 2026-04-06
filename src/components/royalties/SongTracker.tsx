import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface Song {
  id: string;
  title: string;
  artist_name: string | null;
  streams: number;
  expected_publishing: number;
  actual_publishing: number;
  isrc: string | null;
  iswc: string | null;
  registered_capasso: boolean;
  registered_samro: boolean;
}

const getStatus = (s: Song) => {
  if (s.actual_publishing === 0 && s.expected_publishing === 0) return { label: "⚠️ Not Registered", color: "text-yellow-400" };
  if (s.expected_publishing > s.actual_publishing) return { label: "⚠️ Underpaid", color: "text-destructive" };
  return { label: "✅ OK", color: "text-green-400" };
};

const SongTracker = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", artist_name: "", streams: "", expected_publishing: "", actual_publishing: "", isrc: "", iswc: "", registered_capasso: false, registered_samro: false });

  const load = async () => {
    const { data } = await supabase.from("songs").select("*").order("streams", { ascending: false });
    setSongs((data as Song[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const { error } = await supabase.from("songs").insert({
      title: form.title,
      artist_name: form.artist_name || null,
      streams: Number(form.streams) || 0,
      expected_publishing: Number(form.expected_publishing) || 0,
      actual_publishing: Number(form.actual_publishing) || 0,
      isrc: form.isrc || null,
      iswc: form.iswc || null,
      registered_capasso: form.registered_capasso,
      registered_samro: form.registered_samro,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Song added" });
    setOpen(false);
    setForm({ title: "", artist_name: "", streams: "", expected_publishing: "", actual_publishing: "", isrc: "", iswc: "", registered_capasso: false, registered_samro: false });
    load();
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm uppercase tracking-widest font-bold">Song Performance</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Add Song</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Song</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Song Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Artist Name" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} />
              <Input placeholder="Total Streams" type="number" value={form.streams} onChange={(e) => setForm({ ...form, streams: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Expected Pub (R)" type="number" value={form.expected_publishing} onChange={(e) => setForm({ ...form, expected_publishing: e.target.value })} />
                <Input placeholder="Actual Pub (R)" type="number" value={form.actual_publishing} onChange={(e) => setForm({ ...form, actual_publishing: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="ISRC" value={form.isrc} onChange={(e) => setForm({ ...form, isrc: e.target.value })} />
                <Input placeholder="ISWC" value={form.iswc} onChange={(e) => setForm({ ...form, iswc: e.target.value })} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.registered_capasso} onCheckedChange={(v) => setForm({ ...form, registered_capasso: !!v })} />
                  CAPASSO
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.registered_samro} onCheckedChange={(v) => setForm({ ...form, registered_samro: !!v })} />
                  SAMRO
                </label>
              </div>
              <Button onClick={handleAdd} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Song</TableHead>
              <TableHead className="text-right">Streams</TableHead>
              <TableHead className="text-right">Expected Pub</TableHead>
              <TableHead className="text-right">Actual Pub</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {songs.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No songs tracked yet</TableCell></TableRow>
            )}
            {songs.map((s) => {
              const status = getStatus(s);
              const diff = Number(s.expected_publishing) - Number(s.actual_publishing);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-right">{Number(s.streams).toLocaleString()}</TableCell>
                  <TableCell className="text-right">R {Number(s.expected_publishing).toLocaleString()}</TableCell>
                  <TableCell className="text-right">R {Number(s.actual_publishing).toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-bold ${diff > 0 ? "text-destructive" : "text-green-400"}`}>
                    R {diff.toLocaleString()}
                  </TableCell>
                  <TableCell className={status.color}>{status.label}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SongTracker;
