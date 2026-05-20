import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Save, Rocket, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/lib/musicTier";
import { formatZAR } from "@/lib/musicTier";

type Draft = Partial<Track> & { id: string };

type Issue = { level: "error" | "warn"; msg: string };

function validateTrack(t: Track): Issue[] {
  const out: Issue[] = [];
  if (!t.title?.trim()) out.push({ level: "error", msg: "Title is required" });
  if (!t.artist_name?.trim()) out.push({ level: "error", msg: "Artist name is required" });
  if (!t.r2_object_key?.trim()) out.push({ level: "error", msg: "R2 object key is required" });
  const pf = Number(t.pct_free), ps = Number(t.pct_standard), pg = Number(t.pct_gold);
  for (const [name, v] of [["Free %", pf], ["Standard %", ps], ["Gold %", pg]] as const) {
    if (Number.isNaN(v) || v < 0 || v > 1) out.push({ level: "error", msg: `${name} must be between 0 and 1` });
  }
  if (pf > ps) out.push({ level: "error", msg: "Free % cannot exceed Standard %" });
  if (ps > pg) out.push({ level: "error", msg: "Standard % cannot exceed Gold %" });
  if (pg < 1) out.push({ level: "warn", msg: "Gold % is below 100% — full song will be capped" });
  if (pf === 0) out.push({ level: "warn", msg: "Free preview is 0% — listeners hear nothing without paying" });
  for (const [name, v] of [
    ["Standard price", t.price_standard_cents],
    ["Gold price", t.price_gold_cents],
    ["Download price", t.price_download_cents],
  ] as const) {
    if (v == null || Number.isNaN(Number(v)) || Number(v) < 0)
      out.push({ level: "error", msg: `${name} must be a non-negative integer (cents)` });
  }
  if (!t.is_active) out.push({ level: "error", msg: "Track must be active to publish" });
  if (!t.cover_url) out.push({ level: "warn", msg: "No cover image — release card will use a placeholder" });
  return out;
}

export default function MusicAdmin() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

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
    setPreviewId(null);
    if (error) toast.error("Publish failed", { description: error.message });
    else { toast.success("Published as New Single"); load(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  const previewTrack = previewId ? { ...tracks.find((t) => t.id === previewId)!, ...drafts[previewId] } as Track : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Music Tier Admin</h2>
          <p className="text-sm text-muted-foreground">Edit prices, tier percentages, and active status. Save per row.</p>
        </div>
      </div>

      {tracks.map((t) => {
        const d = { ...t, ...drafts[t.id] } as Track;
        const dirty = !!drafts[t.id];
        const issues = validateTrack(d);
        const hasErrors = issues.some((i) => i.level === "error");
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

            {issues.length > 0 && (
              <div className="mb-4 space-y-1">
                {issues.map((i, idx) => (
                  <div key={idx} className={`flex items-center gap-2 text-xs ${i.level === "error" ? "text-destructive" : "text-amber-500"}`}>
                    <AlertTriangle className="w-3 h-3" /> {i.msg}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save(t.id)} disabled={!dirty || savingId === t.id} size="sm">
                {savingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
              <Button
                onClick={() => setPreviewId(t.id)}
                disabled={savingId === t.id || hasErrors}
                variant="outline"
                size="sm"
                title={hasErrors ? "Fix validation errors first" : "Preview & publish"}
              >
                <Rocket className="w-4 h-4" /> Publish as New Single…
              </Button>
            </div>
          </Card>
        );
      })}

      {previewTrack && (
        <PublishPreviewDialog
          track={previewTrack}
          dirty={!!drafts[previewTrack.id]}
          saving={savingId === previewTrack.id}
          issues={validateTrack(previewTrack)}
          onClose={() => setPreviewId(null)}
          onConfirm={() => publishAsNewSingle(previewTrack)}
        />
      )}
    </div>
  );
}

function PublishPreviewDialog({
  track, issues, saving, dirty, onClose, onConfirm,
}: {
  track: Track; issues: Issue[]; saving: boolean; dirty: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const blocking = issues.some((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warn");
  const pctFree = Math.round(Number(track.pct_free) * 100);
  const pctStd  = Math.round(Number(track.pct_standard) * 100);
  const pctGold = Math.round(Number(track.pct_gold) * 100);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish as New Single</DialogTitle>
          <DialogDescription>
            Review how this release will appear on the public site before publishing.
          </DialogDescription>
        </DialogHeader>

        {dirty && (
          <div className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-md px-3 py-2">
            You have unsaved edits — Save first so the published release uses the latest values.
          </div>
        )}

        {/* Public release card preview */}
        <div className="rounded-xl border border-border overflow-hidden bg-gradient-to-br from-card to-secondary/40">
          <div className="aspect-[16/9] bg-secondary flex items-center justify-center overflow-hidden">
            {track.cover_url
              ? <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
              : <span className="text-xs uppercase tracking-widest text-muted-foreground">No cover image</span>}
          </div>
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">New Single</p>
            <h3 className="font-display text-xl font-bold leading-tight">{track.title || "—"}</h3>
            <p className="text-xs text-muted-foreground">{track.artist_name || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Pill label="Free preview" v={`${pctFree}%`} />
          <Pill label="Standard"    v={`${pctStd}% · ${formatZAR(track.price_standard_cents)}`} />
          <Pill label="Gold"        v={`${pctGold}% · ${formatZAR(track.price_gold_cents)}`} />
        </div>

        <div className="text-xs text-muted-foreground">
          Download price <span className="text-foreground">{formatZAR(track.price_download_cents)}</span> · sort <span className="text-foreground">{track.sort_order}</span> · <span className="text-foreground">{track.is_active ? "active" : "inactive"}</span>
        </div>

        {issues.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {issues.map((i, idx) => (
              <div key={idx} className={`flex items-start gap-2 text-xs ${i.level === "error" ? "text-destructive" : "text-amber-500"}`}>
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {i.msg}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-500">
            <CheckCircle2 className="w-3 h-3" /> All checks passed.
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={blocking || saving}
            className="bg-gradient-to-br from-amber-400 to-yellow-600 text-black"
            title={blocking ? "Resolve errors before publishing" : warnings.length ? "Publishing with warnings" : "Publish now"}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Rocket className="w-4 h-4 mr-1" />}
            {blocking ? "Resolve errors" : warnings.length ? "Publish anyway" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pill({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono text-xs mt-0.5">{v}</p>
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
