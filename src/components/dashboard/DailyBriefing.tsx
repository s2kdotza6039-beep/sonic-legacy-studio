import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2,
  Clock,
  Inbox,
  Wallet,
  Users,
  Radio,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

type Draft = { id: string; draft_type: string; title: string; status: string; command: string | null; created_at: string };
type Todo = { id: string; title: string; description: string | null; category: string; priority: string; due_date: string | null; is_done: boolean };
type Reminder = { id: string; message: string; reminder_type: string; due_at: string; is_done: boolean };
type Deal = { id: string; deal_title: string; client_name: string | null; stage: string; amount: number | null };
type Artist = { id: string; name: string; status: string | null; genre: string | null };
type Release = { id: string; title: string; artist_name: string | null; release_type: string; status: string; is_featured: boolean };

const DailyBriefing = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [d, t, r, de, ar, rel] = await Promise.all([
      supabase.from("ai_drafts").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(15),
      supabase.from("ceo_todos").select("*").eq("is_done", false).order("due_date", { ascending: true }).limit(12),
      supabase.from("reminders").select("*").eq("is_done", false).order("due_at", { ascending: true }).limit(10),
      supabase.from("deals").select("*").not("stage", "eq", "Closed").order("created_at", { ascending: false }).limit(10),
      supabase.from("artists").select("*").limit(20),
      supabase.from("releases").select("*").order("created_at", { ascending: false }).limit(8),
    ]);
    if (d.data) setDrafts(d.data as Draft[]);
    if (t.data) setTodos(t.data as Todo[]);
    if (r.data) setReminders(r.data as Reminder[]);
    if (de.data) setDeals(de.data as Deal[]);
    if (ar.data) setArtists(ar.data as Artist[]);
    if (rel.data) setReleases(rel.data as Release[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const totalApprovals = drafts.length;
  const totalPriorities = todos.length + reminders.length;
  const totalRevenue = deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const sectionCard = "border border-border bg-card p-5";
  const label = "text-[11px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2";

  const stat = (title: string, value: string | number) => (
    <div className={sectionCard}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="text-2xl font-display font-bold text-primary mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className={sectionCard}>
        <p className="text-[11px] uppercase tracking-widest text-primary flex items-center gap-2">
          <Sparkles size={13} /> SYDNEY · Daily Briefing
        </p>
        <h2 className="text-2xl font-display font-bold mt-2">
          Good morning{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>
        <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
          I'm SYDNEY, your Personal Assistant. Here's what needs your attention today — approvals first, then
          priorities, then the health of the business. I'll explain my recommendations before you approve anything.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stat("To Approve", totalApprovals)}
        {stat("Priorities", totalPriorities)}
        {stat("Pipeline Value", `R ${totalRevenue.toLocaleString()}`)}
        {stat("Roster", artists.length)}
      </div>

      {loading && <p className="text-xs text-muted-foreground italic">Loading briefing…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={sectionCard}>
          <p className={label}>
            <Inbox size={13} className="text-primary" /> Needs Your Approval
          </p>
          {drafts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nothing awaiting approval. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{d.title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{d.draft_type}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(d.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={sectionCard}>
          <p className={label}>
            <Clock size={13} className="text-primary" /> Priorities & Reminders
          </p>
          {todos.length === 0 && reminders.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No open priorities. You're on track.</p>
          ) : (
            <ul className="space-y-2">
              {todos.map((t) => (
                <li key={t.id} className="flex items-start gap-2 border-b border-border/50 pb-2 last:border-0">
                  <CheckCircle2 size={13} className="text-muted-foreground mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{t.title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.priority}
                      {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {reminders.map((r) => (
                <li key={r.id} className="flex items-start gap-2 border-b border-border/50 pb-2 last:border-0">
                  <AlertTriangle size={13} className="text-primary mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.message}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      due {new Date(r.due_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={sectionCard}>
          <p className={label}>
            <Wallet size={13} className="text-primary" /> Deals & Revenue
          </p>
          {deals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active deals in the pipeline.</p>
          ) : (
            <ul className="space-y-2">
              {deals.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{d.deal_title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {d.client_name ?? "—"} · {d.stage}
                    </p>
                  </div>
                  <span className="text-xs text-primary shrink-0">R {Number(d.amount || 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={sectionCard}>
          <p className={label}>
            <Users size={13} className="text-primary" /> Artists & Releases
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Roster</p>
          <ul className="space-y-2 mb-4">
            {artists.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="truncate">{a.name}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{a.status ?? "—"}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Recent Releases</p>
          {releases.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No releases yet.</p>
          ) : (
            <ul className="space-y-2">
              {releases.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
                  <Radio size={13} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{r.title}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyBriefing;
