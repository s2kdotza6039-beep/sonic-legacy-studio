import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Star, Disc3 } from "lucide-react";
import CloudflareCloudButton from "@/components/CloudflareCloudButton";

interface Release {
  id: string;
  artist_id: string;
  artist_name: string;
  title: string;
  release_type: string;
  status: string;
  cover_url: string | null;
  cloudflare_url: string | null;
  is_featured: boolean;
  sort_order: number;
}

const empty: Omit<Release, "id"> = {
  artist_id: "",
  artist_name: "",
  title: "",
  release_type: "Single",
  status: "New Single",
  cover_url: "",
  cloudflare_url: "",
  is_featured: true,
  sort_order: 0,
};

const RELEASE_TYPES = ["Single", "EP", "Album", "Feature"];
const STATUSES = ["New Single", "Released", "Archived", "Coming Soon"];

export default function ReleasesManager() {
  const { toast } = useToast();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [form, setForm] = useState<Omit<Release, "id">>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("releases")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load releases", description: error.message, variant: "destructive" });
    } else {
      setReleases((data || []) as Release[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, sort_order: (releases[releases.length - 1]?.sort_order ?? 0) + 1 });
    setOpen(true);
  };

  const openEdit = (r: Release) => {
    setEditing(r);
    setForm({
      artist_id: r.artist_id,
      artist_name: r.artist_name,
      title: r.title,
      release_type: r.release_type,
      status: r.status,
      cover_url: r.cover_url ?? "",
      cloudflare_url: r.cloudflare_url ?? "",
      is_featured: r.is_featured,
      sort_order: r.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.artist_name.trim() || !form.title.trim()) {
      toast({ title: "Missing fields", description: "Artist name and title are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      cover_url: form.cover_url?.trim() || null,
      cloudflare_url: form.cloudflare_url?.trim() || null,
      artist_id: form.artist_id.trim() || form.artist_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    };
    const { error } = editing
      ? await supabase.from("releases").update(payload).eq("id", editing.id)
      : await supabase.from("releases").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Release updated" : "Release created" });
    setOpen(false);
    load();
  };

  const remove = async (r: Release) => {
    if (!confirm(`Delete "${r.title}" by ${r.artist_name}?`)) return;
    const { error } = await supabase.from("releases").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Release deleted" });
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = releases[index];
    const b = releases[index + dir];
    if (!a || !b) return;
    // swap sort_order values
    const { error: e1 } = await supabase.from("releases").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("releases").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (e1 || e2) {
      toast({ title: "Reorder failed", description: (e1 || e2)?.message, variant: "destructive" });
      return;
    }
    load();
  };

  const toggleFeatured = async (r: Release) => {
    const { error } = await supabase.from("releases").update({ is_featured: !r.is_featured }).eq("id", r.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Disc3 className="text-primary" size={20} />
          <div>
            <h2 className="text-xl font-display font-bold">Releases CMS</h2>
            <p className="text-xs text-muted-foreground">Manage singles shown on the Listen Now page.</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus size={14} /> New Release
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : releases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No releases yet. Create your first single.</p>
      ) : (
        <div className="space-y-2">
          {releases.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border border-border bg-background/50 px-3 py-3"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === releases.length - 1}
                  className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              {r.cover_url ? (
                <img src={r.cover_url} alt="" className="w-12 h-12 object-cover border border-border" />
              ) : (
                <div className="w-12 h-12 bg-secondary border border-border flex items-center justify-center text-muted-foreground/50">
                  <Disc3 size={16} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-muted-foreground truncate">
                  {r.artist_name}
                </p>
                <p className="font-display font-semibold truncate">{r.title}</p>
              </div>

              <div className="hidden md:flex flex-col items-end text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>{r.release_type}</span>
                <span className="text-primary/80">{r.status}</span>
              </div>

              <CloudflareCloudButton
                release={r}
                source="releases-admin"
                compact
                label="Cloud"
              />

              <button
                onClick={() => toggleFeatured(r)}
                title={r.is_featured ? "Featured" : "Not featured"}
                className={`p-2 transition-colors ${r.is_featured ? "text-primary" : "text-muted-foreground/50 hover:text-primary"}`}
              >
                <Star size={14} fill={r.is_featured ? "currentColor" : "none"} />
              </button>

              <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                <Trash2 size={14} className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Release" : "New Release"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Artist Name *</Label>
                <Input
                  value={form.artist_name}
                  onChange={(e) => setForm({ ...form, artist_name: e.target.value })}
                  placeholder="Pitch Black Afro"
                />
              </div>
              <div>
                <Label className="text-xs">Artist Slug</Label>
                <Input
                  value={form.artist_id}
                  onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
                  placeholder="pitch-black-afro"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Kule Life"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.release_type} onValueChange={(v) => setForm({ ...form, release_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELEASE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Cover Image URL</Label>
              <Input
                value={form.cover_url ?? ""}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <div>
              <Label className="text-xs">Cloudflare Cloud URL</Label>
              <Input
                value={form.cloudflare_url ?? ""}
                onChange={(e) => setForm({ ...form, cloudflare_url: e.target.value })}
                placeholder="https://newsingle.s2kdotza.com/…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-3 pb-2">
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
                <Label className="text-xs">Featured</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
