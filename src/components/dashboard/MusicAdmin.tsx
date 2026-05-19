import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Rocket } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/lib/musicTier";

type Draft = Partial<Track> & { id: string };

export default function MusicAdmin() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("tracks").select("*").order("sort_order");
    setTracks((data ?? []) as Track[]);
    setDrafts({});
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const edit = (id: string, patch: Partial<Track>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], id, ...patch } }));

  const save = async (id: string) => {
    const patch = drafts[id];
    if (!patch) return;
    setSavingId(id);
    const { id: _omit, ...update } = patch;
    const { error } = await supabase.from("tracks").update(update).eq("id", id);
    setSavingId(null);
    if (error) toast.error("Save failed", { description: error.message });
    else { toast.success("Track saved"); load(); }
  };

  const publishAsNewSingle = async (t: Track) => {
    setSavingId(t.id);
    const top = Math.min(...tracks.map((x) => x.sort_order), 0) - 1;
    const { error } = await supabase.from("tracks").update({
      is_active: true, sort_order: top,
    }).eq("id", t.id);
    if (!error) {
      await supabase.from("releases").insert({
        artist_id: t.artist_slug ?? "unknown",
        artist_name: t.artist_name,
        title: t.title,
        release_type: "Single",
        status: "New Single",
        is_featured: true,
        cover_url: t.cover_url,
      });
    }
    setSavingId(null);
    if (error) toast.error("Publish failed", { description: error.message });
    else { toast.success("Published as New Single"); load(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Music Tier Admin</h2>
          <p className="text-sm text-muted-foreground">Edit prices, tier percentages, and active status. Save per row.</p>
        </div>
      </div>

      {tracks.map((t) => {
        const d = { ...t, ...drafts[t.id] };
        const dirty = !!drafts[t.id];
        return (
          <Card key={t.id} className="p-5">
            <div className="flex items-start justify-between mb-4 gap-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.artist_name}</p>
                <h3 className="font-display text-lg font-bold">{t.title}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1">{t.r2_object_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Active</span>
                <Switch
                  checked={!!d.is_active}
                  onCheckedChange={(v) => edit(t.id, { is_active: v })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Field label="Standard (cents)" type="number"
                value={d.price_standard_cents}
                onChange={(v) => edit(t.id, { price_standard_cents: Number(v) })} />
              <Field label="Gold (cents)" type="number"
                value={d.price_gold_cents}
                onChange={(v) => edit(t.id, { price_gold_cents: Number(v) })} />
              <Field label="Download (cents)" type="number"
                value={d.price_download_cents}
                onChange={(v) => edit(t.id, { price_download_cents: Number(v) })} />
              <Field label="Sort order" type="number"
                value={d.sort_order}
                onChange={(v) => edit(t.id, { sort_order: Number(v) })} />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <PctSlider label="Free %" value={Number(d.pct_free)}
                onChange={(v) => edit(t.id, { pct_free: v })} />
              <PctSlider label="Standard %" value={Number(d.pct_standard)}
                onChange={(v) => edit(t.id, { pct_standard: v })} />
              <PctSlider label="Gold %" value={Number(d.pct_gold)}
                onChange={(v) => edit(t.id, { pct_gold: v })} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save(t.id)} disabled={!dirty || savingId === t.id} size="sm">
                {savingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
              <Button onClick={() => publishAsNewSingle(t)} disabled={savingId === t.id} variant="outline" size="sm">
                <Rocket className="w-4 h-4" /> Publish as New Single
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string | number | undefined;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function PctSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div>
      <div className="flex justify-between">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
        <span className="text-xs tabular-nums">{pct}%</span>
      </div>
      <input
        type="range" min={0} max={100} step={1} value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full mt-2"
      />
    </div>
  );
}
