import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, FileSignature, CalendarCheck, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type DraftRow = {
  id: string;
  draft_type: string;
  title: string;
  status: string;
  source: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type EventRow = {
  id: string;
  title: string;
  artist_name: string | null;
  venue: string | null;
  city: string | null;
  start_date: string;
  status: string;
};

const detailLine = (p: Record<string, unknown> | null) => {
  const det = (p?.details ?? {}) as Record<string, string>;
  return [det.party, det.event_name, det.event_date, det.amount].filter(Boolean).join(" · ");
};

/** Founder-only approval queue for coordinator contract drafts and event drafts. */
const ApprovalQueue = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const logAction = useCallback(
    async (action: string, entity_type: string, entity_id: string, summary: string, after?: unknown) => {
      await supabase.from("action_log").insert({
        actor_id: user?.id,
        actor_role: "founder",
        actor_email: user?.email,
        action,
        entity_type,
        entity_id,
        summary,
        after: (after ?? {}) as never,
      });
    },
    [user],
  );

  const load = useCallback(async () => {
    const [dr, ev] = await Promise.all([
      supabase
        .from("ai_drafts")
        .select("id, draft_type, title, status, source, payload, created_at")
        .eq("status", "pending")
        .in("draft_type", ["contract", "event"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("events")
        .select("id, title, artist_name, venue, city, start_date, status")
        .in("status", ["draft", "review"])
        .order("start_date", { ascending: true })
        .limit(100),
    ]);
    setDrafts((dr.data ?? []) as DraftRow[]);
    setEvents(ev.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approveDraft = async (d: DraftRow) => {
    setBusy(d.id);
    const { error } = await supabase.rpc("approve_ai_draft", { _draft_id: d.id });
    setBusy(null);
    if (error) {
      toast({ title: "Could not approve", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("draft_approved", d.draft_type, d.id, `Approved ${d.draft_type} draft "${d.title}"`, {
      source: d.source,
    });
    toast({ title: "Approved", description: `"${d.title}" is live.` });
    void load();
  };

  const rejectDraft = async (d: DraftRow) => {
    const reason = window.prompt("Reason for rejection (optional)") ?? undefined;
    setBusy(d.id);
    const { error } = await supabase.rpc("reject_ai_draft", { _draft_id: d.id, _reason: reason });
    setBusy(null);
    if (error) {
      toast({ title: "Could not reject", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("draft_rejected", d.draft_type, d.id, `Rejected ${d.draft_type} draft "${d.title}"`, { reason });
    toast({ title: "Rejected" });
    void load();
  };

  const setEventStatus = async (ev: EventRow, status: "published" | "cancelled") => {
    setBusy(ev.id);
    const { error } = await supabase
      .from("events")
      .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
      .eq("id", ev.id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    await logAction(
      status === "published" ? "event_approved" : "event_rejected",
      "events",
      ev.id,
      `${status === "published" ? "Published" : "Cancelled"} event "${ev.title}"`,
      { status },
    );
    toast({ title: status === "published" ? "Event published" : "Event cancelled" });
    void load();
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft size={12} /> Back to workspace
          </Link>
          <p className="text-sm uppercase tracking-widest text-primary mb-2">S2KDOTZA · Private</p>
          <h1 className="text-3xl md:text-5xl font-display font-bold">Approval Queue</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
            Contract drafts and event drafts submitted by the coordinator. Every decision is logged.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-5xl mx-auto space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading queue…
          </div>
        ) : (
          <>
            <section className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileSignature size={15} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary">Contract &amp; content drafts</p>
              </div>
              {drafts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing pending.</p>
              ) : (
                <div className="divide-y divide-border">
                  {drafts.map((d) => (
                    <div key={d.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{d.title}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {d.draft_type} · {d.source} · {new Date(d.created_at).toLocaleString()}
                        </p>
                        {detailLine(d.payload) && (
                          <p className="text-xs text-muted-foreground mt-1">{detailLine(d.payload)}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy === d.id} onClick={() => void approveDraft(d)}>
                          <Check size={12} /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === d.id}
                          onClick={() => void rejectDraft(d)}
                        >
                          <X size={12} /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck size={15} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary">Event drafts</p>
              </div>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No event drafts waiting.</p>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((ev) => (
                    <div key={ev.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{ev.title}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {ev.status} · {new Date(ev.start_date).toLocaleDateString()} · {ev.venue ?? "—"} ·{" "}
                          {ev.city ?? "—"} · {ev.artist_name ?? "—"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy === ev.id} onClick={() => void setEventStatus(ev, "published")}>
                          <Check size={12} /> Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === ev.id}
                          onClick={() => void setEventStatus(ev, "cancelled")}
                        >
                          <X size={12} /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ApprovalQueue;
