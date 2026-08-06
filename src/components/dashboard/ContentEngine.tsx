import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  X,
  TrendingUp,
  FlaskConical,
  Activity,
  CalendarClock,
  CalendarCheck2,
  FilePenLine,
  Hash,
  Wand2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentPost {
  id: string;
  title: string;
  platform: string | null;
  url: string | null;
  views: number;
  tag: string;
  posted_at: string | null;
  scheduled_at: string | null;
  post_status: string;
  hashtags: string | null;
  caption: string | null;
}

const HIGH_THRESHOLD = 10000;
const LOW_THRESHOLD = 1000;

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Facebook", "X", "Spotify", "SoundCloud"];

const emptyForm = {
  title: "",
  platform: "",
  url: "",
  views: "",
  caption: "",
  hashtags: "",
  scheduled_at: "",
  post_status: "published",
};

const ContentEngine = () => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data } = await supabase.from("content_posts").select("*").order("posted_at", { ascending: false });
    if (data) setPosts(data as ContentPost[]);
  };

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("content-engine")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_posts" }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const generateCaption = () => {
    if (!form.title.trim()) {
      toast({ title: "Add a title first", description: "MPUMI needs a title to write the caption." });
      return;
    }
    const platformLine = form.platform ? `${form.platform === "YouTube" ? "Watch" : "Stream"} now 👉 s2kdotza.com` : "Stream/watch now 👉 s2kdotza.com";
    const tags = form.hashtags?.trim() || "#s2kDOTza #SouthAfricanMusic";
    setForm((f) => ({
      ...f,
      hashtags: tags,
      caption: `${form.title} 🎧\n\n${platformLine}\n${tags}`,
    }));
    toast({ title: "MPUMI wrote a caption" });
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const views = parseInt(form.views) || 0;
    const tag = views >= HIGH_THRESHOLD ? "WINNER" : views <= LOW_THRESHOLD ? "TEST" : "untagged";
    const isScheduled = form.post_status === "scheduled";
    const { error } = await supabase.from("content_posts").insert({
      title: form.title,
      platform: form.platform || null,
      url: form.url || null,
      views,
      tag,
      caption: form.caption || null,
      hashtags: form.hashtags || null,
      post_status: form.post_status,
      scheduled_at: isScheduled && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      posted_at: form.post_status === "published" ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setForm(emptyForm);
    setShowForm(false);
    toast({ title: isScheduled ? "Post scheduled" : form.post_status === "draft" ? "Draft saved" : "Content published" });
  };

  const filtered = posts
    .filter((p) => (filter === "all" ? true : p.tag === filter))
    .filter((p) => (statusFilter === "all" ? true : (p.post_status || "published") === statusFilter));

  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const winners = posts.filter((p) => p.tag === "WINNER").length;
  const tests = posts.filter((p) => p.tag === "TEST").length;
  const metrics = [
    { label: "Posts", value: posts.length.toLocaleString(), sub: "" },
    { label: "Total Views", value: totalViews.toLocaleString(), sub: "" },
    { label: "Avg / Post", value: posts.length ? Math.round(totalViews / posts.length).toLocaleString() : "0", sub: "" },
    { label: "Winners", value: winners.toLocaleString(), sub: `${tests} tests` },
  ];

  const countBy = (s: string) => posts.filter((p) => (p.post_status || "published") === s).length;
  const pipeline = [
    { label: "Scheduled", value: countBy("scheduled"), Icon: CalendarClock, color: "text-amber-400", border: "border-amber-500/30" },
    { label: "Published", value: countBy("published"), Icon: CalendarCheck2, color: "text-green-400", border: "border-green-500/30" },
    { label: "Drafts", value: countBy("draft"), Icon: FilePenLine, color: "text-muted-foreground", border: "border-border" },
  ];

  const recent = [...posts]
    .sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime())
    .slice(0, 10);

  const tagStyle: Record<string, string> = {
    WINNER: "bg-green-500/20 text-green-400 border-green-500/30",
    TEST: "bg-primary/20 text-primary border-primary/30",
    untagged: "bg-muted text-muted-foreground border-border",
  };

  const statusStyle: Record<string, string> = {
    published: "bg-green-500/15 text-green-400 border-green-500/30",
    scheduled: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    draft: "bg-muted text-muted-foreground border-border",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
  };

  const inputCls = "bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">Social Vault <span className="text-xs font-sans font-normal text-muted-foreground">(MPUMI · Social Media Specialist)</span></h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Content"}
        </button>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {pipeline.map(({ label, value, Icon, color, border }) => (
          <div key={label} className={`border ${border} bg-card p-3`}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Icon size={12} className={color} /> {label}
            </p>
            <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className="border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.label}</p>
            <p className="text-xl font-display font-bold text-primary">{m.value}</p>
            {m.sub && <p className="text-[10px] text-muted-foreground">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-2">
        {["all", "WINNER", "TEST", "untagged"].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${filter === t ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "published", "scheduled", "draft"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${statusFilter === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {s === "all" ? "All Status" : s}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="border border-border bg-secondary/30 p-4 mb-4 space-y-3">
          <input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full ${inputCls}`} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className={inputCls}>
              <option value="">Platform…</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input placeholder="Views" type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} className={inputCls} />
          </div>
          <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={`w-full ${inputCls}`} />
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-primary shrink-0" />
            <input placeholder="#hashtags" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} className={`flex-1 ${inputCls}`} />
            <button onClick={generateCaption} className="flex items-center gap-1 border border-primary text-primary px-3 py-2 text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors shrink-0">
              <Wand2 size={13} /> MPUMI Caption
            </button>
          </div>
          <textarea placeholder="Caption" rows={3} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className={`w-full ${inputCls}`} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.post_status} onChange={(e) => setForm({ ...form, post_status: e.target.value })} className={inputCls}>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              disabled={form.post_status !== "scheduled"}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              className={`${inputCls} disabled:opacity-40`}
            />
          </div>
          <button onClick={handleAdd} disabled={saving} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No content matches your filters.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {p.tag === "WINNER" && <TrendingUp size={14} className="text-green-400" />}
                {p.tag === "TEST" && <FlaskConical size={14} className="text-primary" />}
                <span className="font-semibold text-sm truncate">{p.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {p.platform && <span>{p.platform}</span>}
                <span>{p.views.toLocaleString()} views</span>
                {p.post_status === "scheduled" && p.scheduled_at && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <CalendarClock size={11} /> {new Date(p.scheduled_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {p.caption && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{p.caption}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-sm ${statusStyle[p.post_status || "published"] || ""}`}>{p.post_status || "published"}</span>
              <span className={`text-xs px-3 py-1 border rounded-sm ${tagStyle[p.tag] || ""}`}>{p.tag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div className="mt-6 border border-border bg-card">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Activity size={14} className="text-primary" />
          <h4 className="text-xs uppercase tracking-widest font-bold">Activity Feed</h4>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 && <p className="p-4 text-xs text-muted-foreground">No activity yet.</p>}
          {recent.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-xs truncate flex-1">{p.title}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{p.views.toLocaleString()} views</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{p.posted_at ? new Date(p.posted_at).toLocaleDateString() : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentEngine;
