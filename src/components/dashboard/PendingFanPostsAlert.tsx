import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Pending = {
  id: string;
  title: string;
  media_url: string | null;
  media_type: string | null;
  thumb_url: string | null;
  created_at: string;
};

/** Alerts moderators the moment a fan post lands in the queue, with inline approve/reject. */
const PendingFanPostsAlert = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("fan_posts")
      .select("id, title, media_url, media_type, thumb_url, created_at")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) return;
    const rows = (data ?? []) as Pending[];
    if (!first.current) {
      const fresh = rows.filter((r) => !seen.current.has(r.id));
      if (fresh.length > 0) {
        toast({
          title: `${fresh.length} fan post${fresh.length > 1 ? "s" : ""} awaiting moderation`,
          description: fresh[0].title,
        });
      }
    }
    seen.current = new Set(rows.map((r) => r.id));
    first.current = false;
    setPending(rows);
  }, [toast]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("pending-fan-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "fan_posts" }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [load]);

  const moderate = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    const note =
      decision === "rejected" ? window.prompt("Reason for rejecting this post (optional)") ?? null : null;
    const { error } = await supabase
      .from("fan_posts")
      .update({
        moderation_status: decision,
        moderation_note: note,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: decision === "approved" ? "Approved — live in the Fan Zone" : "Rejected",
    });
    void load();
  };

  if (loading || pending.length === 0) return null;

  return (
    <div className="border border-primary/40 bg-primary/[0.05] rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={15} className="text-primary" />
        <p className="text-xs uppercase tracking-widest text-primary">
          {pending.length} fan post{pending.length > 1 ? "s" : ""} pending moderation
        </p>
        <button
          onClick={() => void load()}
          aria-label="Refresh pending fan posts"
          className="ml-auto text-muted-foreground hover:text-primary"
        >
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border border-border bg-card p-2 rounded-lg">
            {p.thumb_url || p.media_url ? (
              <img
                src={p.thumb_url ?? p.media_url ?? ""}
                alt={`Preview of fan post: ${p.title}`}
                className="w-14 h-14 object-cover rounded"
                loading="lazy"
              />
            ) : (
              <div className="w-14 h-14 rounded bg-secondary" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{p.title}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(p.created_at).toLocaleString()} · {p.media_type ?? "no media"}
              </p>
            </div>
            <button
              disabled={busy === p.id}
              onClick={() => void moderate(p.id, "approved")}
              aria-label={`Approve fan post ${p.title}`}
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest border border-primary/50 text-primary px-2 py-1 rounded-full hover:bg-primary hover:text-primary-foreground"
            >
              <Check size={11} aria-hidden="true" /> Approve
            </button>
            <button
              disabled={busy === p.id}
              onClick={() => void moderate(p.id, "rejected")}
              aria-label={`Reject fan post ${p.title}`}
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest border border-border text-muted-foreground px-2 py-1 rounded-full hover:text-destructive hover:border-destructive"
            >
              <X size={11} aria-hidden="true" /> Reject
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingFanPostsAlert;
