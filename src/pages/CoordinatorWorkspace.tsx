import { useCallback, useEffect, useState } from "react";
import { Calendar, Megaphone, FileSignature, History, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import FanZoneAdmin from "@/components/dashboard/FanZoneAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EventRow = {
  id: string;
  title: string;
  artist_name: string | null;
  venue: string | null;
  city: string | null;
  start_date: string;
  status: string;
};
type Artist = { id: string; name: string; genre: string | null; status: string };
type Template = { id: string; title: string; contract_type: string; content: string | null };
type LogRow = {
  id: string;
  action: string;
  entity_type: string;
  summary: string | null;
  created_at: string;
};

const TABS = [
  { key: "events", label: "Shows & Events", icon: Calendar },
  { key: "social", label: "Social & Fan Zone", icon: Megaphone },
  { key: "contracts", label: "Event Contracts", icon: FileSignature },
  { key: "activity", label: "My Activity", icon: History },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const emptyEvent = { title: "", artist_name: "", venue: "", city: "", start_date: "" };
const emptyDraft = { party: "", event_name: "", event_date: "", amount: "", notes: "" };

const CoordinatorWorkspace = () => {
  const { user } = useAuth();
  const { isFounder, isCoordinator, loading } = useUserRole();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("events");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [roster, setRoster] = useState<Artist[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [form, setForm] = useState(emptyEvent);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const logAction = useCallback(
    async (action: string, entity_type: string, entity_id: string | null, summary: string, after?: unknown) => {
      await supabase.from("action_log").insert({
        actor_id: user?.id,
        actor_role: isFounder ? "founder" : "coordinator",
        actor_email: user?.email,
        action,
        entity_type,
        entity_id,
        summary,
        after: (after ?? {}) as never,
      });
    },
    [user, isFounder],
  );

  const loadAll = useCallback(async () => {
    const [ev, ar, tp, lg] = await Promise.all([
      supabase.from("events").select("id, title, artist_name, venue, city, start_date, status").order("start_date", { ascending: true }).limit(100),
      supabase.from("artists").select("id, name, genre, status").order("name").limit(100),
      supabase.from("contract_templates").select("id, title, contract_type, content").eq("coordinator_visible", true).order("title"),
      supabase.from("action_log").select("id, action, entity_type, summary, created_at").eq("actor_id", user?.id ?? "").order("created_at", { ascending: false }).limit(100),
    ]);
    setEvents(ev.data ?? []);
    setRoster(ar.data ?? []);
    setTemplates(tp.data ?? []);
    setLogs(lg.data ?? []);
  }, [user?.id]);

  useEffect(() => {
    if (!loading && user) void loadAll();
  }, [loading, user, loadAll]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordinator && !isFounder) return <Navigate to="/" replace />;

  const addEvent = async () => {
    if (!form.title.trim() || !form.start_date) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: form.title.trim(),
        artist_name: form.artist_name.trim() || null,
        venue: form.venue.trim() || null,
        city: form.city.trim() || null,
        start_date: form.start_date,
        status: "draft",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Could not save event", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("event_created", "events", data?.id ?? null, `Drafted event "${form.title}"`, form);
    setForm(emptyEvent);
    toast({ title: "Event drafted", description: "The Founder publishes it when it's ready." });
    void loadAll();
  };

  const setEventStatus = async (ev: EventRow, status: string) => {
    const { error } = await supabase.from("events").update({ status }).eq("id", ev.id);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("event_status_changed", "events", ev.id, `"${ev.title}" → ${status}`, { status });
    void loadAll();
  };

  const submitContractDraft = async () => {
    if (!selectedTemplate || !draft.party.trim()) {
      toast({ title: "Party name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const title = `${selectedTemplate.title} — ${draft.party}`;
    const { error } = await supabase.from("ai_drafts").insert({
      draft_type: "contract",
      title,
      status: "pending",
      source: "lerato",
      created_by: user?.id,
      payload: {
        template_id: selectedTemplate.id,
        template_title: selectedTemplate.title,
        contract_type: selectedTemplate.contract_type,
        content: selectedTemplate.content,
        details: draft,
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("contract_draft_submitted", "ai_drafts", null, `Submitted "${title}" for approval`, draft);
    setDraft(emptyDraft);
    setSelectedTemplate(null);
    toast({
      title: "Pending approval",
      description: "The Founder will review before it becomes a real contract.",
    });
    void loadAll();
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-2">S2KDOTZA · Restricted</p>
          <h1 className="text-3xl md:text-5xl font-display font-bold">Coordinator Workspace</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
            LERATO — Events &amp; Social Coordinator · Your office. Your work is logged for the Founder.
            Money &amp; company contracts are admin-only.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              <t.icon size={12} aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "events" && (
          <div className="space-y-6">
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-primary">Add an event</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="Artist" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} />
                <Input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input type="date" aria-label="Start date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <Button onClick={() => void addEvent()} disabled={saving} size="sm">
                Save as draft
              </Button>
            </div>

            <div className="border border-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-primary mb-3">Roster (read-only)</p>
              <div className="flex flex-wrap gap-2">
                {roster.length === 0 && <p className="text-xs text-muted-foreground">No artists yet.</p>}
                {roster.map((a) => (
                  <span key={a.id} className="text-[10px] uppercase tracking-widest border border-border px-2.5 py-1 rounded-full text-muted-foreground">
                    {a.name} · {a.genre ?? "—"}
                  </span>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-xl divide-y divide-border">
              {events.length === 0 && <p className="p-4 text-xs text-muted-foreground">No events yet.</p>}
              {events.map((ev) => (
                <div key={ev.id} className="p-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{ev.title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(ev.start_date).toLocaleDateString()} · {ev.venue ?? "—"} · {ev.city ?? "—"}
                    </p>
                  </div>
                  <select
                    aria-label={`Status for ${ev.title}`}
                    value={ev.status}
                    onChange={(e) => void setEventStatus(ev, e.target.value)}
                    className="bg-background border border-border text-[10px] uppercase tracking-widest px-2 py-1 rounded"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Ready for review</option>
                    {(ev.status === "published" || isFounder) && <option value="published">Published</option>}
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "social" && <FanZoneAdmin />}

        {tab === "contracts" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Event-related templates only. Submissions go to the Founder's approval queue.
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">No templates shared with you yet.</p>
              )}
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                    selectedTemplate?.id === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>

            {selectedTemplate && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs uppercase tracking-widest text-primary">{selectedTemplate.title}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Client / party name" value={draft.party} onChange={(e) => setDraft({ ...draft, party: e.target.value })} />
                  <Input placeholder="Event name" value={draft.event_name} onChange={(e) => setDraft({ ...draft, event_name: e.target.value })} />
                  <Input type="date" aria-label="Event date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
                  <Input placeholder="Fee / amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                </div>
                <Textarea placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                <Button onClick={() => void submitContractDraft()} disabled={saving} size="sm">
                  Submit for approval
                </Button>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Pending approval — the Founder will review before it becomes a real contract.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="border border-border rounded-xl divide-y divide-border">
            {logs.length === 0 && <p className="p-4 text-xs text-muted-foreground">No activity logged yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="p-3">
                <p className="text-sm">{l.summary ?? l.action}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {l.action} · {l.entity_type} · {new Date(l.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CoordinatorWorkspace;
