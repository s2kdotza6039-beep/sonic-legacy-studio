import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Check, X, FileText, Calendar, Megaphone, Receipt, Sparkles, Clock, ShieldCheck,
  Loader2, ListChecks, Rocket, Music, CalendarCheck, Inbox, Building2, UserPlus, Plus, Zap,
  Pencil, Save, Search, History, Repeat, Trash2, Power,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  { key: "schedules", label: "Schedules", icon: Repeat },
  { key: "history", label: "Command History", icon: History },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "bookings", label: "Bookings", icon: Inbox },
  { key: "sponsors", label: "Sponsors", icon: Building2 },
  { key: "applications", label: "Artist Applications", icon: UserPlus },
  { key: "activity", label: "Activity", icon: Clock },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Editable fields per draft type
const EDITABLE_FIELDS: Record<string, { key: string; label: string; type: "text" | "textarea" | "datetime" | "number" }[]> = {
  news_post: [
    { key: "excerpt", label: "Excerpt", type: "textarea" },
    { key: "body", label: "Body", type: "textarea" },
    { key: "category", label: "Category", type: "text" },
    { key: "image_url", label: "Image URL", type: "text" },
  ],
  event: [
    { key: "description", label: "Description", type: "textarea" },
    { key: "venue", label: "Venue", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "start_date", label: "Start (ISO)", type: "text" },
    { key: "ticket_url", label: "Ticket URL", type: "text" },
    { key: "artist_name", label: "Artist", type: "text" },
  ],
  announcement: [
    { key: "body", label: "Body", type: "textarea" },
    { key: "banner_color", label: "Banner color", type: "text" },
  ],
  invoice: [
    { key: "client_name", label: "Client", type: "text" },
    { key: "client_email", label: "Client email", type: "text" },
    { key: "total", label: "Total", type: "number" },
    { key: "due_date", label: "Due date", type: "text" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  social_caption: [{ key: "body", label: "Caption", type: "textarea" }],
  homepage_update: [{ key: "body", label: "Body", type: "textarea" }],
  artist_update: [{ key: "body", label: "Update", type: "textarea" }],
  music_update: [{ key: "body", label: "Update", type: "textarea" }],
  booking_reply: [{ key: "message", label: "Message", type: "textarea" }],
  sponsor_reply: [{ key: "message", label: "Message", type: "textarea" }],
  other: [{ key: "body", label: "Body", type: "textarea" }],
};

const QUICK_COMMANDS = [
  "RUN DAILY CONTENT",
  "GENERATE DAILY NEWS",
  "WRITE LATEST NEWS POST",
  "WRITE ARTIST UPDATES",
  "CREATE EVENT ANNOUNCEMENT",
  "GIVE ME 5 CONTENT IDEAS TODAY",
  "DRIVE TRAFFIC TO WEBSITE",
  "WRITE FOUNDER MESSAGE",
];

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
  const [runningCmd, setRunningCmd] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPayload, setEditPayload] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Filters for booking/sponsor/applications
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatus, setBookingStatus] = useState("all");
  const [bookingFrom, setBookingFrom] = useState("");
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [sponsorStatus, setSponsorStatus] = useState("all");
  const [sponsorFrom, setSponsorFrom] = useState("");
  const [appSearch, setAppSearch] = useState("");
  const [appStatus, setAppStatus] = useState("all");
  const [appFrom, setAppFrom] = useState("");

  const load = async () => {
    setLoading(true);
    const [d, l, t, i, b, s, a] = await Promise.all([
      supabase.from("ai_drafts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_activity_log").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("ceo_todos").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(200),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("booking_enquiries").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("sponsor_leads").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("artists").select("id, name, status, genre, created_at").order("created_at", { ascending: false }).limit(200),
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

  const startEdit = (d: Draft) => {
    setEditingId(d.id);
    setEditTitle(d.title);
    setEditPayload({ ...(d.payload || {}) });
  };

  const cancelEdit = () => { setEditingId(null); setEditPayload({}); setEditTitle(""); };

  const saveEdit = async (d: Draft) => {
    setSavingEdit(true);
    const { error } = await supabase
      .from("ai_drafts")
      .update({ title: editTitle, payload: editPayload })
      .eq("id", d.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Draft updated" });
      cancelEdit();
      load();
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredDrafts = drafts.filter((d) => filter === "all" ? true : d.status === filter);
  const pendingDrafts = filteredDrafts.filter((d) => d.status === "pending");
  const allSelected = pendingDrafts.length > 0 && pendingDrafts.every((d) => selected.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pendingDrafts.map((d) => d.id)));
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Approve & publish ${selected.size} draft(s)?`)) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      const { error } = await supabase.rpc("approve_ai_draft", { _draft_id: id });
      if (error) fail++; else ok++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    toast({ title: `Bulk approve: ${ok} ok, ${fail} failed` });
    load();
  };

  const bulkReject = async () => {
    if (selected.size === 0) return;
    const reason = window.prompt(`Reject ${selected.size} draft(s). Reason (optional):`) ?? "";
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      const { error } = await supabase.rpc("reject_ai_draft", { _draft_id: id, _reason: reason || null });
      if (error) fail++; else ok++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    toast({ title: `Bulk reject: ${ok} ok, ${fail} failed` });
    load();
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

  const runCommand = async (command: string) => {
    setRunningCmd(command);
    try {
      const { error } = await supabase.functions.invoke("front-desk-assistant", {
        body: { messages: [{ role: "user", content: command }] },
      });
      if (error) throw error;
      setTimeout(load, 1500);
      toast({ title: `Ran: ${command}`, description: "Drafts queued for approval." });
    } catch (e: any) {
      toast({ title: "Command failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRunningCmd(null);
    }
  };

  const pendingCount = drafts.filter((d) => d.status === "pending").length;
  const dailyTasks = todos.filter((t) => !t.is_done);

  // Filtered lists
  const filteredBookings = useMemo(() => bookings.filter((b) => {
    if (bookingStatus !== "all" && b.status !== bookingStatus) return false;
    if (bookingFrom && new Date(b.created_at) < new Date(bookingFrom)) return false;
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      if (!`${b.name} ${b.email} ${b.event_type ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [bookings, bookingStatus, bookingFrom, bookingSearch]);

  const filteredSponsors = useMemo(() => sponsors.filter((s) => {
    if (sponsorStatus !== "all" && s.status !== sponsorStatus) return false;
    if (sponsorFrom && new Date(s.created_at) < new Date(sponsorFrom)) return false;
    if (sponsorSearch) {
      const q = sponsorSearch.toLowerCase();
      if (!`${s.company} ${s.contact_name ?? ""} ${s.email ?? ""} ${s.industry ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sponsors, sponsorStatus, sponsorFrom, sponsorSearch]);

  const filteredApps = useMemo(() => applications.filter((a) => {
    if (appStatus !== "all" && a.status !== appStatus) return false;
    if (appFrom && new Date(a.created_at) < new Date(appFrom)) return false;
    if (appSearch) {
      const q = appSearch.toLowerCase();
      if (!`${a.name} ${a.genre ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [applications, appStatus, appFrom, appSearch]);

  const bookingStatuses = useMemo(() => ["all", ...Array.from(new Set(bookings.map((b) => b.status)))], [bookings]);
  const sponsorStatuses = useMemo(() => ["all", ...Array.from(new Set(sponsors.map((s) => s.status)))], [sponsors]);
  const appStatuses = useMemo(() => ["all", ...Array.from(new Set(applications.map((a) => a.status)))], [applications]);

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

      {/* Quick commands */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
            <Zap size={12} className="text-primary" /> Quick Commands
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">One click → AI generates drafts → review in Pending Approvals.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((cmd) => (
            <Button
              key={cmd}
              size="sm"
              variant="outline"
              disabled={!!runningCmd}
              onClick={() => runCommand(cmd)}
              className="text-[11px] uppercase tracking-widest gap-1.5"
            >
              {runningCmd === cmd ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
              {cmd}
            </Button>
          ))}
        </CardContent>
      </Card>

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
          <div className="flex gap-2 flex-wrap items-center">
            {(["pending", "all", "published", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(new Set()); }}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest border transition ${
                  filter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Bulk action bar */}
          {pendingDrafts.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap border border-border bg-secondary/30 px-3 py-2">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : `Select all (${pendingDrafts.length})`}
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" disabled={selected.size === 0 || bulkBusy} onClick={bulkReject} className="gap-1 text-xs">
                  <X size={12} /> Bulk Reject
                </Button>
                <Button size="sm" disabled={selected.size === 0 || bulkBusy} onClick={bulkApprove} className="gap-1 text-xs">
                  {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Bulk Approve
                </Button>
              </div>
            </div>
          )}

          {filteredDrafts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No {filter} drafts.</CardContent></Card>
          ) : (
            filteredDrafts.map((d) => {
              const meta = TYPE_META[d.draft_type] ?? TYPE_META.other;
              const Icon = meta.icon;
              const isEditing = editingId === d.id;
              const fields = EDITABLE_FIELDS[d.draft_type] ?? EDITABLE_FIELDS.other;
              return (
                <Card key={d.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {d.status === "pending" && (
                          <Checkbox
                            className="mt-2"
                            checked={selected.has(d.id)}
                            onCheckedChange={() => toggleSelect(d.id)}
                          />
                        )}
                        <div className={`mt-1 ${meta.color}`}><Icon size={18} /></div>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-base font-display" />
                          ) : (
                            <CardTitle className="text-base font-display">{d.title}</CardTitle>
                          )}
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
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit} className="gap-1 text-xs">Cancel</Button>
                              <Button size="sm" onClick={() => saveEdit(d)} disabled={savingEdit} className="gap-1 text-xs">
                                {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEdit(d)} className="gap-1 text-xs"><Pencil size={12} /> Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => reject(d.id)} disabled={busyId === d.id} className="gap-1 text-xs"><X size={12} /> Reject</Button>
                              <Button size="sm" onClick={() => approve(d.id)} disabled={busyId === d.id} className="gap-1 text-xs">
                                {busyId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {isEditing ? (
                      <div className="space-y-3">
                        {fields.map((f) => {
                          const val = editPayload?.[f.key] ?? "";
                          const onChange = (v: string) =>
                            setEditPayload((p: any) => ({ ...p, [f.key]: f.type === "number" ? Number(v) : v }));
                          return (
                            <div key={f.key} className="space-y-1">
                              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.label}</label>
                              {f.type === "textarea" ? (
                                <Textarea value={String(val ?? "")} onChange={(e) => onChange(e.target.value)} className="min-h-[80px] text-sm" />
                              ) : (
                                <Input
                                  type={f.type === "number" ? "number" : "text"}
                                  value={String(val ?? "")}
                                  onChange={(e) => onChange(e.target.value)}
                                  className="h-9 text-sm"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <DraftPreview type={d.draft_type} payload={d.payload} />
                    )}
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
          <CardHeader><CardTitle className="text-sm">Booking Enquiries ({filteredBookings.length}/{bookings.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FilterBar
              search={bookingSearch} onSearch={setBookingSearch} placeholder="Search name, email, event…"
              status={bookingStatus} onStatus={setBookingStatus} statuses={bookingStatuses}
              from={bookingFrom} onFrom={setBookingFrom}
            />
            {filteredBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <div className="space-y-2">
                {filteredBookings.map((b) => (
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
          <CardHeader><CardTitle className="text-sm">Sponsor Leads ({filteredSponsors.length}/{sponsors.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FilterBar
              search={sponsorSearch} onSearch={setSponsorSearch} placeholder="Search company, contact, industry…"
              status={sponsorStatus} onStatus={setSponsorStatus} statuses={sponsorStatuses}
              from={sponsorFrom} onFrom={setSponsorFrom}
            />
            {filteredSponsors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <div className="space-y-2">
                {filteredSponsors.map((s) => (
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
          <CardHeader><CardTitle className="text-sm">Artist Applications ({filteredApps.length}/{applications.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FilterBar
              search={appSearch} onSearch={setAppSearch} placeholder="Search artist, genre…"
              status={appStatus} onStatus={setAppStatus} statuses={appStatuses}
              from={appFrom} onFrom={setAppFrom}
            />
            {filteredApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <div className="space-y-2">
                {filteredApps.map((a) => (
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

const FilterBar = ({
  search, onSearch, placeholder, status, onStatus, statuses, from, onFrom,
}: {
  search: string; onSearch: (v: string) => void; placeholder: string;
  status: string; onStatus: (v: string) => void; statuses: string[];
  from: string; onFrom: (v: string) => void;
}) => (
  <div className="flex gap-2 flex-wrap items-center">
    <div className="relative flex-1 min-w-[180px]">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-9 pl-8 text-xs" />
    </div>
    <select
      value={status}
      onChange={(e) => onStatus(e.target.value)}
      className="h-9 px-2 text-xs border border-input bg-background rounded-md"
    >
      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
    <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9 w-auto text-xs" />
    {(search || status !== "all" || from) && (
      <Button size="sm" variant="ghost" onClick={() => { onSearch(""); onStatus("all"); onFrom(""); }} className="h-9 text-xs">Clear</Button>
    )}
  </div>
);

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
