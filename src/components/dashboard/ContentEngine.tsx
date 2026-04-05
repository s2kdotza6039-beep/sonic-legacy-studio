import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, TrendingUp, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentPost {
  id: string;
  title: string;
  platform: string | null;
  url: string | null;
  views: number;
  tag: string;
  posted_at: string | null;
}

const HIGH_THRESHOLD = 10000;
const LOW_THRESHOLD = 1000;

const ContentEngine = () => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ title: "", platform: "", url: "", views: "" });
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data } = await supabase.from("content_posts").select("*").order("posted_at", { ascending: false });
    if (data) setPosts(data);
  };

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("content-engine")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_posts" }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const views = parseInt(form.views) || 0;
    const tag = views >= HIGH_THRESHOLD ? "WINNER" : views <= LOW_THRESHOLD ? "TEST" : "untagged";
    const { error } = await supabase.from("content_posts").insert({
      title: form.title, platform: form.platform || null, url: form.url || null, views, tag,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setForm({ title: "", platform: "", url: "", views: "" });
    setShowForm(false);
    toast({ title: "Content added" });
  };

  const updateViews = async (id: string, views: number) => {
    const tag = views >= HIGH_THRESHOLD ? "WINNER" : views <= LOW_THRESHOLD ? "TEST" : "untagged";
    await supabase.from("content_posts").update({ views, tag }).eq("id", id);
  };

  const filtered = filter === "all" ? posts : posts.filter((p) => p.tag === filter);

  const tagStyle: Record<string, string> = {
    WINNER: "bg-green-500/20 text-green-400 border-green-500/30",
    TEST: "bg-primary/20 text-primary border-primary/30",
    untagged: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">Content Engine</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Content"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["all", "WINNER", "TEST", "untagged"].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${filter === t ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="border border-border bg-secondary/30 p-4 mb-4 space-y-3">
          <input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Platform (YouTube, IG...)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
            <input placeholder="Views" type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          </div>
          <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-6 py-2 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">Add</button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No content yet.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {p.tag === "WINNER" && <TrendingUp size={14} className="text-green-400" />}
                {p.tag === "TEST" && <FlaskConical size={14} className="text-primary" />}
                <span className="font-semibold text-sm truncate">{p.title}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {p.platform && <span>{p.platform}</span>}
                <span>{p.views.toLocaleString()} views</span>
              </div>
            </div>
            <span className={`text-xs px-3 py-1 border rounded-sm ${tagStyle[p.tag] || ""}`}>{p.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentEngine;
