import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ShieldCheck, ListTodo, DollarSign, Users, Disc3, RefreshCw } from "lucide-react";

type Todo = { id: string; title: string; priority: string; due_date: string | null };
type Draft = { id: string; title: string; draft_type: string; created_at: string };
type Deal = { id: string; deal_title: string; client_name: string; amount: number | null; stage: string };
type Artist = { id: string; name: string; status: string; updated_at: string };
type Release = { id: string; title: string; artist_name: string; status: string; released_at: string | null };

const currency = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

const Section = ({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  count?: number;
  children: React.ReactNode;
}) => (
  <div className="border border-border bg-card p-5">
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} className="text-primary" />
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs text-primary font-mono">{count}</span>
      )}
    </div>
    {children}
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <p className="text-xs text-muted-foreground italic">{label}</p>
);

const DailyBriefing = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, t, dl, inv, a, r] = await Promise.all([
        supabase.from("ai_drafts").select("id,title,draft_type,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(6),
        supabase.from("ceo_todos").select("id,title,priority,due_date").eq("is_done", false).order("due_date", { ascending: true, nullsFirst: false }).limit(6),
        supabase.from("deals").select("id,deal_title,client_name,amount,stage").neq("stage", "closed").order("updated_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("total,status").neq("status", "paid"),
        supabase.from("artists").select("id,name,status,updated_at").order("updated_at", { ascending: false }).limit(5),
        supabase.from("releases").select("id,title,artist_name,status,released_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const firstErr = [d, t, dl, inv, a, r].find((x) => x.error)?.error;
      if (firstErr) throw firstErr;

      setDrafts(d.data ?? []);
      setTodos(t.data ?? []);
      setDeals(dl.data ?? []);
      setUnpaidTotal((inv.data ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0));
      setUnpaidCount((inv.data ?? []).length);
      setArtists(a.data ?? []);
      setReleases(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load briefing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-primary" />
              <p className="text-xs uppercase tracking-widest text-primary">Daily Briefing</p>
            </div>
            <h2 className="text-2xl font-display font-bold">{today}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Pulling live data…" : `${drafts.length} approvals · ${todos.length} priorities · ${unpaidCount} unpaid invoices`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-xs uppercase tracking-widest border border-border px-3 py-2 hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={ShieldCheck} title="Awaiting your approval" count={drafts.length}>
          {drafts.length === 0 ? (
            <Empty label="No pending AI drafts." />
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{d.title}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{d.draft_type}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={ListTodo} title="Today's priorities" count={todos.length}>
          {todos.length === 0 ? (
            <Empty label="Nothing outstanding." />
          ) : (
            <ul className="space-y-2">
              {todos.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{t.title}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString("en-ZA") : t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={DollarSign} title="Money">
          <div className="mb-4">
            <p className="text-2xl font-display font-bold text-primary">{currency(unpaidTotal)}</p>
            <p className="text-xs text-muted-foreground">Outstanding across {unpaidCount} invoice(s)</p>
          </div>
          {deals.length === 0 ? (
            <Empty label="No open deals." />
          ) : (
            <ul className="space-y-2">
              {deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{d.deal_title} · {d.client_name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                    {d.amount ? currency(Number(d.amount)) : d.stage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Users} title="Artists" count={artists.length}>
          {artists.length === 0 ? (
            <Empty label="No artists in the pipeline." />
          ) : (
            <ul className="space-y-2">
              {artists.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{a.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Disc3} title="Releases" count={releases.length}>
          {releases.length === 0 ? (
            <Empty label="No releases yet." />
          ) : (
            <ul className="space-y-2">
              {releases.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{r.title} · {r.artist_name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                    {r.released_at ? new Date(r.released_at).toLocaleDateString("en-ZA") : r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
};

export default DailyBriefing;
