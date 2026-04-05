import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Artist {
  id: string;
  name: string;
  email: string | null;
  genre: string | null;
  music_link: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUSES = ["New Artist", "In Conversation", "Signed", "Rejected"];

const statusColor: Record<string, string> = {
  "New Artist": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Conversation": "bg-primary/20 text-primary border-primary/30",
  "Signed": "bg-green-500/20 text-green-400 border-green-500/30",
  "Rejected": "bg-destructive/20 text-destructive border-destructive/30",
};

const ArtistPipeline = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", genre: "", music_link: "", notes: "" });
  const { toast } = useToast();

  const fetchArtists = async () => {
    const { data } = await supabase.from("artists").select("*").order("created_at", { ascending: false });
    if (data) setArtists(data);
  };

  useEffect(() => {
    fetchArtists();
    const channel = supabase
      .channel("artists-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "artists" }, fetchArtists)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("artists").insert({
      name: form.name, email: form.email || null, genre: form.genre || null,
      music_link: form.music_link || null, notes: form.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setForm({ name: "", email: "", genre: "", music_link: "", notes: "" });
    setShowForm(false);
    toast({ title: "Artist added" });
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("artists").update({ status }).eq("id", id);
  };

  const timeSince = (date: string) => {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">Artist Pipeline</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Artist"}
        </button>
      </div>

      {showForm && (
        <div className="border border-border bg-secondary/30 p-4 mb-4 space-y-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
            <input placeholder="Genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          </div>
          <input placeholder="Music Link" value={form.music_link} onChange={(e) => setForm({ ...form, music_link: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none" rows={2} />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-6 py-2 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">Add</button>
        </div>
      )}

      <div className="space-y-2">
        {artists.length === 0 && <p className="text-sm text-muted-foreground">No artists yet. Add your first artist above.</p>}
        {artists.map((a) => (
          <div key={a.id} className="border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-semibold text-sm truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{timeSince(a.created_at)}</span>
              </div>
              {a.genre && <span className="text-xs text-muted-foreground">{a.genre}</span>}
            </div>
            <select
              value={a.status}
              onChange={(e) => updateStatus(a.id, e.target.value)}
              className={`text-xs px-3 py-1 border rounded-sm bg-transparent cursor-pointer outline-none ${statusColor[a.status] || "border-border"}`}
            >
              {STATUSES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtistPipeline;
