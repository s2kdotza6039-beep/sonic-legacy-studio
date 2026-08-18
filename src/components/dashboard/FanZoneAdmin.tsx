import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Send, Trash2, Plus, Heart, Eye, MessageCircle, Upload, Loader2, X, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { makeThumbnail } from "@/lib/mediaThumbnail";
import { resumableUpload } from "@/lib/resumableUpload";


type FanPost = {
  id: string;
  title: string;
  likes: number;
  views: number;
  status: string;
  created_at: string;
  media_url: string | null;
  media_type: string;
  thumb_url: string | null;
  moderation_status: string;
  moderation_note: string | null;
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
  thumb_url: "",
  media_type: "image",
  artist_tag: "",
  status: "published",
};

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];

const MEDIA_BUCKET = "fan-media";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years — public feed links
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 200;

const FanZoneAdmin = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<FanPost[]>([]);
  const [messages, setMessages] = useState<FanMessage[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyPost);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadMs, setUploadMs] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMedia = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast({
        title: "Unsupported file type",
        description: `${file.type || "That file"} can't be posted. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.`,
        variant: "destructive",
      });
      return;
    }
    const allowed = isImage ? ALLOWED_IMAGE : ALLOWED_VIDEO;
    if (!allowed.includes(file.type)) {
      toast({
        title: "Unsupported media type",
        description: `${file.type} isn't supported. Allowed: ${allowed.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    const limit = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB;
    if (file.size > limit * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit for ${isImage ? "images" : "video"} is ${limit}MB.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadName(file.name);
    setUploadMs(null);
    setProgress(0);
    setUploadNote(null);
    const started = performance.now();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = Date.now();
    const path = `posts/${stamp}-${safe}`;
    const thumbPath = `posts/thumbs/${stamp}-${safe.replace(/\.[^.]+$/, "")}.jpg`;

    try {
      await resumableUpload({
        bucket: MEDIA_BUCKET,
        path,
        file,
        contentType: file.type,
        onProgress: setProgress,
        onRetry: (_a, message) => setUploadNote(message),
      });
    } catch (e) {
      setUploading(false);
      setProgress(0);
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
      return;
    }

    // Thumbnail: downscaled image, or the first readable video frame.
    let thumbUrl = "";
    try {
      const thumb = await makeThumbnail(file);
      await resumableUpload({
        bucket: MEDIA_BUCKET,
        path: thumbPath,
        file: thumb,
        contentType: "image/jpeg",
      });
      const { data: signedThumb } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(thumbPath, SIGNED_URL_TTL);
      thumbUrl = signedThumb?.signedUrl ?? "";
    } catch {
      setUploadNote("Thumbnail couldn't be generated — the full media will be used instead.");
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    const ms = Math.round(performance.now() - started);
    setUploading(false);
    setUploadMs(ms);
    setProgress(100);
    if (signErr || !signed?.signedUrl) {
      toast({
        title: "Couldn't link media",
        description: signErr?.message ?? "No URL returned",
        variant: "destructive",
      });
      return;
    }
    setForm((f) => ({
      ...f,
      media_url: signed.signedUrl,
      thumb_url: thumbUrl,
      media_type: isImage ? "image" : "video",
    }));
    toast({ title: "Media uploaded", description: `${file.name} ready in ${(ms / 1000).toFixed(1)}s.` });
  };

  const load = async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase
        .from("fan_posts")
        .select("id, title, likes, views, status, created_at, media_url, media_type, thumb_url, moderation_status, moderation_note")
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
      thumb_url: form.thumb_url.trim() || null,
      moderation_status: "pending",
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
    setUploadName(null);
    setUploadMs(null);
    setProgress(0);
    setUploadNote(null);
    toast({
      title: "Post queued for review",
      description: "It appears in the Fan Zone once approved in the moderation queue.",
    });
    load();
  };

  const moderate = async (id: string, decision: "approved" | "rejected") => {
    const note =
      decision === "rejected"
        ? window.prompt("Reason for rejecting this post (optional)") ?? null
        : null;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fan_posts")
      .update({
        moderation_status: decision,
        moderation_note: note,
        moderated_at: new Date().toISOString(),
        moderated_by: auth.user?.id ?? null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Couldn't moderate", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: decision === "approved" ? "Approved — live in the Fan Zone" : "Rejected",
      description: decision === "approved" ? "The majita can see it now." : "It stays hidden from fans.",
    });
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
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMedia(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest border border-border px-3 py-2 hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? "Uploading..." : "Upload image / video"}
              </button>
              {uploadName && (
                <span className="text-[10px] text-muted-foreground">
                  {uploadName}
                  {uploadMs !== null && ` · ${uploadMs}ms`}
                </span>
              )}
              {form.media_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, media_url: "" })}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
                >
                  <X size={11} /> Clear media
                </button>
              )}
            </div>
            {uploading && (
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {progress.toFixed(0)}% uploaded · resumable, retries automatically
                </p>
              </div>
            )}
            {uploadNote && <p className="text-[10px] text-primary">{uploadNote}</p>}
            {form.media_url && (
              <div className="border border-border/70 p-2">
                {form.media_type === "video" ? (
                  <video src={form.media_url} controls className="max-h-48 w-full object-contain" />
                ) : (
                  <img src={form.media_url} alt="Fan post media preview" className="max-h-48 w-full object-contain" />
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Images up to {MAX_IMAGE_MB}MB (JPG, PNG, WEBP, GIF), video up to {MAX_VIDEO_MB}MB (MP4, WEBM, MOV).
              Uploads are resumable and a thumbnail is generated automatically. New posts enter the moderation queue.
            </p>
          </div>

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

      {/* Moderation queue */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <Clock size={14} /> Moderation queue
        </h3>
        {posts.filter((p) => p.moderation_status === "pending").length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
        ) : (
          <div className="space-y-3">
            {posts
              .filter((p) => p.moderation_status === "pending")
              .map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-4 border border-border/70 p-3">
                  {p.thumb_url || p.media_url ? (
                    <img
                      src={p.thumb_url ?? p.media_url ?? ""}
                      alt={`Preview of ${p.title}`}
                      loading="lazy"
                      className="w-20 h-20 object-cover border border-border"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{p.title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                      {p.media_type} · {p.status} · awaiting review
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderate(p.id, "approved")}
                      className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"
                    >
                      <ShieldCheck size={12} /> Approve
                    </button>
                    <button
                      onClick={() => moderate(p.id, "rejected")}
                      className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-destructive hover:text-destructive"
                    >
                      <ShieldX size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
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
                    <span
                      className={
                        p.moderation_status === "approved"
                          ? "text-primary"
                          : p.moderation_status === "rejected"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {p.moderation_status}
                    </span>
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
