import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Check, X, FileText, Calendar, Megaphone, Receipt, Sparkles, Clock, ShieldCheck,
  Loader2, ListChecks, Rocket, Music, CalendarCheck, Inbox, Building2, UserPlus, Plus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Draft = {
  id: string; draft_type: string; title: string; payload: any; status: string;
  command: string | null; source: string; created_at: string; rejected_reason: string | null;
};
type LogRow = {
  id: string; actor: string; action: string; entity_type: string | null;
  entity_id: string | null; command: string | null; metadata: any; created_at: string;
};
type Todo = {
  id: string; title: string; description: string | null; category: string;
  priority: string; due_date: string | null; is_done: boolean;
};
type Invoice = {
  id: string; invoice_number: string; client_name: string; total: number;
  currency: string; status: string; due_date: string | null; created_at: string;
};
type Booking = {
  id: string; name: string; email: string; event_type: string | null;
  event_date: string | null; status: string; created_at: string;
};
type Sponsor = {
  id: string; company: string; contact_name: string | null; email: string | null;
  industry: string | null; budget_range: string | null; status: string; created_at: string;
};
type Artist = { id: string; name: string; status: string; genre: string | null; created_at: string };

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

// Checklist categories — todos are filtered by these category strings
const CHECKLISTS = [
  { key: "Daily Content", icon: ListChecks, color: "text-pink-400" },
  { key: "Launch Checklist", icon: Rocket, color: "text-amber-400" },
  { key: "Music Release", icon: Music, color: "text-emerald-400" },
  { key: "Event Checklist", icon: CalendarCheck, color: "text-purple-400" },
] as const;

const SECTIONS = [
  { key: "approvals", label: "Pending Approvals", icon: ShieldCheck },
  { key: "tasks", label: "Daily Tasks", icon: ListChecks },
  { key: "checklists", label: "Checklists", icon: Rocket },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "bookings", label: "Bookings", icon: Inbox },
  { key: "sponsors", label: "Sponsors", icon: Building2 },
  { key: "applications", label: "Artist Applications", icon: UserPlus },
  { key: "activity", label: "Activity", icon: Clock },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const AICommandCentre = () => {
  const { toast } = useToast();
  const [section, setSection] = useState<SectionKey>("approvals");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [applications, setApplications] = useState<Artist[]>([]);
  const [filter, setFilter] = useState<"pending" | "all" | "published" | "rejected">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [d, l, t, i, b, s, a] = await Promise.all([
      supabase.from("ai_drafts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_activity_log").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("ceo_todos").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(200),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("booking_enquiries").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("sponsor_leads").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("artists").select("id, name, status, genre, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setDrafts((d.data as Draft[]) || []);
    setLog((l.data as LogRow[]) || []);
    setTodos((t.data as Todo[]) || []);
    setInvoices((i.data as Invoice[]) || []);
    setBookings((b.data as Booking[]) || []);
    setSponsors((s.data as Sponsor[]) || []);
    setApplications((a.data as Artist[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("command_centre_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_drafts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_activity_log" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ceo_todos" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const approve = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("approve_ai_draft", { _draft_id: id });
    setBusyId(null);
    if (error) toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Approved & published" }); load(); }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setBusyId(id);
    const { error } = await supabase.rpc("reject_ai_draft", { _draft_id: id, _reason: reason || null });
    setBusyId(null);
    if (error) toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Rejected" }); load(); }
  };

  const toggleTodo = async (todo: Todo) => {
    const { error } = await supabase.from("ceo_todos").update({ is_done: !todo.is_done }).eq("id", todo.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const addTodo = async (category: string) => {
    const title = window.prompt(`New task for "${category}":`);
    if (!title?.trim()) return;
    const { error } = await supabase.from("ceo_todos").insert({ title: title.trim(), category, priority: "medium" });
    if (error) toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    else load();
  };

  const filteredDrafts = drafts.filter((d) =>
    filter === "all" ? true : d.status === filter
  );
  const pendingCount = drafts.filter((d) => d.status === "pending").length;
  const dailyTasks = todos.filter((t) => !t.is_done);
  const newBookings = bookings.filter((b) => b.status === "new").length;
  const newSponsors = sponsors.filter((s) => s.status === "new").length;
  const newApplications = applications.filter((a) => a.status === "New Artist").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" /> s2kdotza AI Command Centre
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Founder-only operations hub. AI proposes — you decide what goes live.
          </p>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 flex-wrap border-b border-border">
        {SECTIONS.map((s) => {
          const count =
            s.key === "approvals" ? pendingCount :
            s.key === "tasks" ? dailyTasks.length :
            s.key === "bookings" ? newBookings :
            s.key === "sponsors" ? newSponsors :
            s.key === "applications" ? newApplications : 0;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-widest border-b-2 transition whitespace-nowrap ${
                section === s.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon size={12} /> {s.label}
              {count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-primary/20 text-primary border border-primary/40">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="inline animate-spin mr-2" size={14} /> Loading…
        </div>
      )}

      {/* APPROVALS */}
      {!loading && section === "approvals" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["pending", "all", "published", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest border transition ${
                  filter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {filteredDrafts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No {filter} drafts.</CardContent></Card>
          ) : (
            filteredDrafts.map((d) => {
              const meta = TYPE_META[d.draft_type] ?? TYPE_META.other;
              const Icon = meta.icon;
              return (
                <Card key={d.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-1 ${meta.color}`}><Icon size={18} /></div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-display">{d.title}</CardTitle>
                          <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                            <Badge variant={d.status === "pending" ? "default" : "outline"} className="text-[10px]">{d.status}</Badge>
                            {d.command && <span>cmd: {d.command}</span>}
                            <span className="flex items-center gap-1"><Clock size={10} /> {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      {d.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => reject(d.id)} disabled={busyId === d.id} className="gap-1 text-xs"><X size={12} /> Reject</Button>
                          <Button size="sm" onClick={() => approve(d.id)} disabled={busyId === d.id} className="gap-1 text-xs">
                            {busyId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <DraftPreview type={d.draft_type} payload={d.payload} />
                    {d.rejected_reason && <p className="mt-2 text-xs text-destructive italic">Rejected: {d.rejected_reason}</p>}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* DAILY TASKS */}
      {!loading && section === "tasks" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Open Tasks ({dailyTasks.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => addTodo("Daily Content")} className="gap-1 text-xs">
              <Plus size={12} /> Add Task
            </Button>
          </CardHeader>
          <CardContent>
            {dailyTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">All tasks done. Solid.</p>
            ) : (
              <ul className="space-y-2">
                {dailyTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0">
                    <Checkbox checked={t.is_done} onCheckedChange={() => toggleTodo(t)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{t.title}</p>
                      <div className="flex gap-2 mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                        <span>{t.priority}</span>
                        {t.due_date && <span>due {format(new Date(t.due_date), "d MMM")}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* CHECKLISTS */}
      {!loading && section === "checklists" && (
        <div className="grid md:grid-cols-2 gap-4">
          {CHECKLISTS.map((cl) => {
            const Icon = cl.icon;
            const items = todos.filter((t) => t.category === cl.key);
            const done = items.filter((t) => t.is_done).length;
            return (
              <Card key={cl.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon size={14} className={cl.color} /> {cl.key}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => addTodo(cl.key)} className="h-6 px-2 text-xs gap-1">
                      <Plus size={10} /> Add
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{done}/{items.length} complete</p>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No items yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((t) => (
                        <li key={t.id} className="flex items-start gap-2 text-sm">
                          <Checkbox checked={t.is_done} onCheckedChange={() => toggleTodo(t)} className="mt-0.5" />
                          <span className={t.is_done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* INVOICES */}
      {!loading && section === "invoices" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice Tracker ({invoices.length})</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet. Ask the AI: "PREPARE INVOICE for [client]".</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.invoice_number} · {inv.client_name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {inv.due_date ? `Due ${format(new Date(inv.due_date), "d MMM yyyy")}` : "No due date"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm">{inv.currency} {Number(inv.total).toLocaleString()}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BOOKINGS */}
      {!loading && section === "bookings" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Booking Enquiries ({bookings.length})</CardTitle></CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booking enquiries yet.</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => (
                  <div key={b.id} className="border-b border-border/40 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm"><strong>{b.name}</strong> · {b.email}</p>
                      <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.event_type || "Event"} {b.event_date ? `· ${format(new Date(b.event_date), "d MMM yyyy")}` : ""} · {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SPONSORS */}
      {!loading && section === "sponsors" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Sponsor Leads ({sponsors.length})</CardTitle></CardHeader>
          <CardContent>
            {sponsors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sponsor leads yet.</p>
            ) : (
              <div className="space-y-2">
                {sponsors.map((s) => (
                  <div key={s.id} className="border-b border-border/40 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm"><strong>{s.company}</strong>{s.contact_name ? ` · ${s.contact_name}` : ""}</p>
                      <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[s.industry, s.budget_range, s.email].filter(Boolean).join(" · ")} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* APPLICATIONS */}
      {!loading && section === "applications" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Artist Applications ({applications.length})</CardTitle></CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No artist applications yet.</p>
            ) : (
              <div className="space-y-2">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {a.genre || "—"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ACTIVITY */}
      {!loading && section === "activity" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
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
                    <span className="text-muted-foreground shrink-0">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const DraftPreview = ({ type, payload }: { type: string; payload: any }) => {
  if (!payload || typeof payload !== "object") return <p className="text-xs text-muted-foreground">No payload.</p>;
  const text =
    payload.body || payload.description || payload.excerpt || payload.message ||
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
