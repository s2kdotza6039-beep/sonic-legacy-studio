import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, X, FileText, Calendar, Megaphone, Receipt, Sparkles, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Draft = {
  id: string;
  draft_type: string;
  title: string;
  payload: any;
  status: string;
  command: string | null;
  source: string;
  created_at: string;
  rejected_reason: string | null;
};

type LogRow = {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  command: string | null;
  metadata: any;
  created_at: string;
};

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  news_post: { icon: FileText, color: "text-blue-400", label: "News" },
  event: { icon: Calendar, color: "text-purple-400", label: "Event" },
  announcement: { icon: Megaphone, color: "text-amber-400", label: "Announcement" },
  invoice: { icon: Receipt, color: "text-green-400", label: "Invoice" },
  social_caption: { icon: Sparkles, color: "text-pink-400", label: "Social" },
  homepage_update: { icon: Sparkles, color: "text-cyan-400", label: "Homepage" },
  artist_update: { icon: Sparkles, color: "text-rose-400", label: "Artist" },
  music_update: { icon: Sparkles, color: "text-emerald-400", label: "Music" },
  booking_reply: { icon: FileText, color: "text-indigo-400", label: "Booking Reply" },
  sponsor_reply: { icon: FileText, color: "text-yellow-400", label: "Sponsor Reply" },
  other: { icon: FileText, color: "text-muted-foreground", label: "Other" },
};

const AICommandCentre = () => {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all" | "published" | "rejected">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: d } = await supabase
      .from("ai_drafts").select("*").order("created_at", { ascending: false }).limit(100);
    const { data: l } = await supabase
      .from("ai_activity_log").select("*").order("created_at", { ascending: false }).limit(30);
    setDrafts((d as Draft[]) || []);
    setLog((l as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ai_drafts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_drafts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_activity_log" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const approve = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("approve_ai_draft", { _draft_id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Approved & published", description: "The draft is now live." });
      load();
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setBusyId(id);
    const { error } = await supabase.rpc("reject_ai_draft", { _draft_id: id, _reason: reason || null });
    setBusyId(null);
    if (error) {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "The draft has been rejected." });
      load();
    }
  };

  const filtered = drafts.filter((d) => {
    if (filter === "all") return true;
    if (filter === "pending") return d.status === "pending";
    if (filter === "published") return d.status === "published";
    if (filter === "rejected") return d.status === "rejected";
    return true;
  });

  const pendingCount = drafts.filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" /> AI Command Centre
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Founder-only approval queue. AI proposes — you decide what goes live.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {pendingCount} pending
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "all", "published", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest border transition ${
              filter === f
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Drafts list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="inline animate-spin mr-2" size={14} /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {filter} drafts.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const meta = TYPE_META[d.draft_type] ?? TYPE_META.other;
            const Icon = meta.icon;
            return (
              <Card key={d.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-1 ${meta.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-display">{d.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          <Badge
                            variant={d.status === "pending" ? "default" : d.status === "published" ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {d.status}
                          </Badge>
                          {d.command && <span>cmd: {d.command}</span>}
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {d.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reject(d.id)}
                          disabled={busyId === d.id}
                          className="gap-1 text-xs"
                        >
                          <X size={12} /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approve(d.id)}
                          disabled={busyId === d.id}
                          className="gap-1 text-xs"
                        >
                          {busyId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <DraftPreview type={d.draft_type} payload={d.payload} />
                  {d.rejected_reason && (
                    <p className="mt-2 text-xs text-destructive italic">Rejected: {d.rejected_reason}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Activity log */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Clock size={14} className="text-primary" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {log.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <span>
                    <span className="text-primary">{l.actor}</span>{" "}
                    <span className="text-muted-foreground">{l.action.replace(/_/g, " ")}</span>{" "}
                    {l.entity_type && <span className="text-foreground">{l.entity_type}</span>}
                    {l.command && <span className="text-muted-foreground"> · {l.command}</span>}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const DraftPreview = ({ type, payload }: { type: string; payload: any }) => {
  if (!payload || typeof payload !== "object") {
    return <p className="text-xs text-muted-foreground">No payload.</p>;
  }
  const text =
    payload.body ||
    payload.description ||
    payload.excerpt ||
    payload.message ||
    (Array.isArray(payload.line_items) ? `${payload.line_items.length} line items · Total: ${payload.total ?? "?"} ${payload.currency ?? ""}` : null);

  return (
    <div className="text-sm space-y-2">
      {text && <p className="text-foreground/80 whitespace-pre-wrap">{String(text).slice(0, 400)}{String(text).length > 400 ? "…" : ""}</p>}
      {type === "event" && (
        <div className="text-xs text-muted-foreground">
          {payload.venue && <span>📍 {payload.venue}{payload.city ? `, ${payload.city}` : ""}</span>}
          {payload.start_date && <span className="ml-3">🗓 {new Date(payload.start_date).toLocaleString()}</span>}
        </div>
      )}
      {type === "invoice" && (
        <div className="text-xs text-muted-foreground">
          {payload.client_name && <span>{payload.client_name}</span>}
          {payload.due_date && <span className="ml-3">due {payload.due_date}</span>}
        </div>
      )}
    </div>
  );
};

export default AICommandCentre;
