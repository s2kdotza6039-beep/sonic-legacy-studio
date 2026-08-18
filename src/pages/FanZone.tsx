import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  Eye,
  MessageCircle,
  Sparkles,
  Send,
  Image as ImageIcon,
  Video,
  Users,
  Flame,
} from "lucide-react";

type FanPost = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type: string;
  artist_tag: string | null;
  likes: number;
  views: number;
  created_at: string;
};

type FanMessage = {
  id: string;
  fan_name: string;
  message: string;
  admin_reply: string | null;
  category: string;
  created_at: string;
};

const CATEGORIES = [
  { value: "question", label: "Question" },
  { value: "shoutout", label: "Shoutout" },
  { value: "qa", label: "Q&A" },
  { value: "fanmail", label: "Fanmail" },
];

const FanZone = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<FanPost[]>([]);
  const [messages, setMessages] = useState<FanMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    fan_name: "",
    fan_email: "",
    category: "question",
    message: "",
  });

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase
          .from("fan_posts")
          .select("id, title, body, media_url, media_type, artist_tag, likes, views, created_at")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("fan_messages")
          .select("id, fan_name, message, admin_reply, category, created_at")
          .eq("is_public", true)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setPosts((p as FanPost[]) ?? []);
      setMessages((m as FanMessage[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const totalViews = useMemo(
    () => posts.reduce((sum, p) => sum + (p.views || 0), 0),
    [posts]
  );

  const handleLike = async (post: FanPost) => {
    if (liked[post.id]) return;
    setLiked((s) => ({ ...s, [post.id]: true }));
    setPosts((list) =>
      list.map((p) => (p.id === post.id ? { ...p, likes: p.likes + 1 } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fan_name.trim() || !form.message.trim()) return;
    setSending(true);
    const { error } = await supabase.from("fan_messages").insert({
      fan_name: form.fan_name.trim(),
      fan_email: form.fan_email.trim() || null,
      category: form.category,
      message: form.message.trim(),
      status: "new",
      is_public: false,
    });
    setSending(false);
    if (error) {
      toast({
        title: "Moemishes on our side",
        description: "Message didn't go through. Try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setForm({ fan_name: "", fan_email: "", category: "question", message: "" });
    toast({
      title: "🔥 Sent!",
      description: "MPUMI's got you — watch the Fan Zone for your shoutout.",
    });
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <Sparkles size={14} /> The s2kDOTza Fan Zone · run by MPUMI
          </p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            Eita! Welcome to the Movement 🔥
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Molo and welcome to the s2kDOTza family. I'm MPUMI — the face and voice of this
            house. This is where we turn noise into legacy, and YOU are part of the story.
            Phando's simple: the culture lives right here at s2kdotza.com. Stay locked in.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 text-muted-foreground">
              <Flame size={14} className="text-primary" /> {posts.length} exclusive posts
            </span>
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 text-muted-foreground">
              <Eye size={14} className="text-primary" /> {totalViews} views
            </span>
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-4 py-2 text-muted-foreground">
              <Users size={14} className="text-primary" /> {messages.length} fans talking
            </span>
          </div>
        </div>
      </div>

      <div className="section-padding max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h2 className="text-2xl font-display font-bold mb-1">The Feed · MPUMI's drops</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Skopo the latest from the motherhouse — exclusives, behind the scenes, and the
              realest moments from the crew.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse uppercase tracking-widest">
                Loading the feed...
              </p>
            ) : posts.length === 0 ? (
              <div className="border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">
                  The feed is warming up, majita. First drops land soon — abashwe.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <article key={post.id} className="border border-border bg-card overflow-hidden">
                    {post.media_url && post.media_type === "image" && (
                      <img
                        src={post.media_url}
                        alt={post.title}
                        loading="lazy"
                        className="w-full max-h-[460px] object-cover"
                      />
                    )}
                    {post.media_url && post.media_type === "video" && (
                      <video src={post.media_url} controls className="w-full max-h-[460px] bg-black" />
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-2">
                        {post.media_type === "image" && <ImageIcon size={14} className="text-primary" />}
                        {post.media_type === "video" && <Video size={14} className="text-primary" />}
                        {post.artist_tag && (
                          <span className="text-[10px] uppercase tracking-widest text-primary border border-primary/40 px-2 py-0.5">
                            {post.artist_tag}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-xl font-display font-bold mb-2">{post.title}</h3>
                      {post.body && (
                        <p className="text-muted-foreground whitespace-pre-line">{post.body}</p>
                      )}
                      <div className="flex items-center gap-5 mt-5">
                        <button
                          onClick={() => handleLike(post)}
                          aria-label="Like this post"
                          className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-colors ${
                            liked[post.id] ? "text-primary" : "text-muted-foreground hover:text-primary"
                          }`}
                        >
                          <Heart size={14} fill={liked[post.id] ? "currentColor" : "none"} />
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                          <Eye size={14} /> {post.views}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Q&A */}
          <section>
            <h2 className="text-2xl font-display font-bold mb-1 flex items-center gap-2">
              <MessageCircle size={20} className="text-primary" /> Fan Q&amp;A
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              The realest questions from the majita — answered straight from the house.
            </p>
            {messages.length === 0 ? (
              <div className="border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">
                  No published Q&amp;As yet. Drop yours on the right — I never sleep on fans.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className="border border-border bg-card p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold">{m.fan_name}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                        {m.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-line">{m.message}</p>
                    {m.admin_reply && (
                      <div className="mt-4 border-l-2 border-primary pl-4">
                        <p className="text-xs uppercase tracking-widest text-primary mb-1">
                          MPUMI responds:
                        </p>
                        <p className="text-foreground/90 whitespace-pre-line">{m.admin_reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Interaction */}
        <aside className="space-y-6">
          <div className="border border-border bg-card p-6">
            <h2 className="text-xl font-display font-bold mb-1">Talk to MPUMI &amp; the crew</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Drop a question, a shoutout, or fanmail. The realest ones get answered in the Fan
              Zone.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="fan_name" className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Your name *
                </label>
                <input
                  id="fan_name"
                  required
                  value={form.fan_name}
                  onChange={(e) => setForm({ ...form, fan_name: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="fan_email" className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Email (optional)
                </label>
                <input
                  id="fan_email"
                  type="email"
                  value={form.fan_email}
                  onChange={(e) => setForm({ ...form, fan_email: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="message" className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Your message *
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary resize-y"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs uppercase tracking-widest px-4 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={14} /> {sending ? "Sending..." : "Send to MPUMI"}
              </button>
            </form>
          </div>

          <div className="border border-primary/40 bg-primary/[0.04] p-6">
            <p className="text-xs uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <Flame size={14} /> Stay locked in
            </p>
            <p className="text-sm text-muted-foreground">
              Want first drops, Q&amp;As with the artists, and the realest content? Everything
              lives here at s2kdotza.com. Tell your people.
            </p>
            <Link
              to="/upcoming"
              className="inline-flex items-center gap-2 mt-4 text-xs uppercase tracking-widest text-primary hover:underline"
            >
              See what's dropping next →
            </Link>
          </div>
        </aside>
      </div>
    </Layout>
  );
};

export default FanZone;
