import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Send, Trash2, Plus, Heart, Eye, MessageCircle, Upload, Loader2, X } from "lucide-react";


type FanPost = {
  id: string;
  title: string;
  likes: number;
  views: number;
  status: string;
  created_at: string;
};

type FanMessage = {
  id: string;
  fan_name: string;
  fan_email: string | null;
  subject: string | null;
  message: string;
  category: string;
  status: string;
  is_public: boolean;
  admin_reply: string | null;
  created_at: string;
};

const emptyPost = {
  title: "",
  body: "",
  media_url: "",
  media_type: "image",
  artist_tag: "",
  status: "published",
};

const FanZoneAdmin = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<FanPost[]>([]);
  const [messages, setMessages] = useState<FanMessage[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyPost);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase
        .from("fan_posts")
        .select("id, title, likes, views, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("fan_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setPosts((p as FanPost[]) ?? []);
    setMessages((m as FanMessage[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveReply = async (id: string, publish: boolean) => {
    const reply = (replies[id] ?? "").trim();
    if (!reply) {
      toast({ title: "Write a reply first", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("fan_messages")
      .update({
        admin_reply: reply,
        status: publish ? "published" : "answered",
        is_public: publish,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: publish ? "Published to Fan Zone" : "Reply saved",
      description: publish ? "The majita can see it now." : "Saved as answered.",
    });
    load();
  };

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("fan_posts").insert({
      title: form.title.trim(),
      body: form.body.trim() || null,
      media_url: form.media_url.trim() || null,
      media_type: form.media_type,
      artist_tag: form.artist_tag.trim() || null,
      status: form.status,
      created_by: "MPUMI",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't post", description: error.message, variant: "destructive" });
      return;
    }
    setForm(emptyPost);
    toast({ title: "Drop is live", description: "Post added to the Fan Zone feed." });
    load();
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("fan_posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const inputCls =
    "w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Sparkles size={18} className="text-primary" /> MPUMI · Fan Zone Control Room
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          The face and voice of s2kDOTza — bring fans, keep them coming.
        </p>
      </div>

      {/* Inbox */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
          <MessageCircle size={14} /> Fan Messages
        </h3>
        <p className="text-xs text-muted-foreground mb-5 border-l-2 border-primary/50 pl-3">
          Reply in MPUMI's voice — warm, on-brand, street-professional. Never sloppy.
        </p>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fan messages yet.</p>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="border border-border/70 p-4">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className="text-sm font-semibold">{m.fan_name}</span>
                  <span className="text-[10px] uppercase tracking-widest border border-border px-2 py-0.5 text-muted-foreground">
                    {m.category}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary">
                    {m.status}
                  </span>
                  {m.fan_email && (
                    <span className="text-[10px] text-muted-foreground">{m.fan_email}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{m.message}</p>
                {m.admin_reply && (
                  <p className="mt-3 text-sm border-l-2 border-primary pl-3 whitespace-pre-line">
                    <span className="text-primary text-xs uppercase tracking-widest block mb-1">
                      MPUMI responds:
                    </span>
                    {m.admin_reply}
                  </p>
                )}
                <textarea
                  rows={2}
                  placeholder="Eita! Thanks for pulling up..."
                  value={replies[m.id] ?? m.admin_reply ?? ""}
                  onChange={(e) => setReplies({ ...replies, [m.id]: e.target.value })}
                  className={`${inputCls} mt-3 resize-y`}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => saveReply(m.id, false)}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-primary/50 transition-colors"
                  >
                    <Send size={12} /> Reply
                  </button>
                  <button
                    onClick={() => saveReply(m.id, true)}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity"
                  >
                    Publish to Fan Zone
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New post */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <Plus size={14} /> New Fan Zone Post
        </h3>
        <form onSubmit={createPost} className="space-y-3">
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
          <textarea
            rows={3}
            placeholder="Body / caption in MPUMI's voice"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className={`${inputCls} resize-y`}
          />
          <input
            placeholder="Media URL (image or video)"
            value={form.media_url}
            onChange={(e) => setForm({ ...form, media_url: e.target.value })}
            className={inputCls}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={form.media_type}
              onChange={(e) => setForm({ ...form, media_type: e.target.value })}
              className={inputCls}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="text">Text</option>
            </select>
            <input
              placeholder="Artist tag"
              value={form.artist_tag}
              onChange={(e) => setForm({ ...form, artist_tag: e.target.value })}
              className={inputCls}
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputCls}
            >
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-xs uppercase tracking-widest px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus size={14} /> {saving ? "Posting..." : "Post to Fan Zone"}
          </button>
        </form>
      </div>

      {/* Posts list */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm uppercase tracking-widest text-primary mb-4">Posts</h3>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border border-border/70 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{p.title}</p>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Heart size={11} /> {p.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} /> {p.views}
                    </span>
                    <span className="text-primary">{p.status}</span>
                  </div>
                </div>
                <button
                  onClick={() => deletePost(p.id)}
                  aria-label="Delete post"
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FanZoneAdmin;
