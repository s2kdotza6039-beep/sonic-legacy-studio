import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, ChevronDown, ChevronUp, Phone, Mail, Music, FileText, MessageSquare, Calendar, ArrowRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Artist {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  genre: string | null;
  music_link: string | null;
  file_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Activity {
  id: string;
  artist_id: string;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const STATUSES = ["New Artist", "In Conversation", "Signed", "Rejected"];

const statusColor: Record<string, string> = {
  "New Artist": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Conversation": "bg-primary/20 text-primary border-primary/30",
  "Signed": "bg-green-500/20 text-green-400 border-green-500/30",
  "Rejected": "bg-destructive/20 text-destructive border-destructive/30",
};

const activityIcon: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  call: Phone,
  meeting: Calendar,
  status_change: ArrowRight,
  email: Mail,
};

const activityLabel: Record<string, string> = {
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  status_change: "Status Change",
  email: "Email",
};

const ACTIVITY_TYPES = ["note", "call", "meeting", "email"];

const ArtistPipeline = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activities, setActivities] = useState<Record<string, Activity[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activityForm, setActivityForm] = useState<{ artistId: string; type: string; description: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", genre: "", music_link: "", notes: "" });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const fetchArtists = async () => {
    const { data } = await supabase.from("artists").select("*").order("created_at", { ascending: false });
    if (data) setArtists(data);
  };

  const fetchActivities = async (artistId: string) => {
    const { data } = await supabase
      .from("artist_activities")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setActivities((prev) => ({ ...prev, [artistId]: data as Activity[] }));
  };

  useEffect(() => {
    fetchArtists();
    const channel = supabase
      .channel("artists-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "artists" }, fetchArtists)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!activities[id]) fetchActivities(id);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("artists").insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      genre: form.genre || null,
      music_link: form.music_link || null,
      notes: form.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setForm({ name: "", email: "", phone: "", genre: "", music_link: "", notes: "" });
    setShowForm(false);
    toast({ title: "Artist added" });
  };

  const updateStatus = async (id: string, newStatus: string, oldStatus: string) => {
    await supabase.from("artists").update({ status: newStatus }).eq("id", id);
    // Auto-log status change as activity
    await supabase.from("artist_activities").insert({
      artist_id: id,
      activity_type: "status_change",
      description: `Status changed from "${oldStatus}" to "${newStatus}"`,
      metadata: { from: oldStatus, to: newStatus },
    });
    if (expandedId === id) fetchActivities(id);
  };

  const addActivity = async () => {
    if (!activityForm || !activityForm.description.trim()) return;
    const { error } = await supabase.from("artist_activities").insert({
      artist_id: activityForm.artistId,
      activity_type: activityForm.type,
      description: activityForm.description,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setActivityForm(null);
    fetchActivities(activityForm.artistId);
    toast({ title: "Activity logged" });
  };

  const timeSince = (date: string) => {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const filtered = statusFilter === "all" ? artists : artists.filter((a) => a.status === statusFilter);
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: artists.filter((a) => a.status === s).length }), {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">Artist Pipeline</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Artist"}
        </button>
      </div>

      {/* Status Summary Bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`border p-2 text-center transition-colors ${
              statusFilter === s ? statusColor[s] : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="text-lg font-display font-bold block">{counts[s]}</span>
            <span className="text-[10px] uppercase tracking-widest">{s}</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="border border-border bg-secondary/30 p-4 mb-4 space-y-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
            <input placeholder="Music Link" value={form.music_link} onChange={(e) => setForm({ ...form, music_link: e.target.value })} className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none" />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none" rows={2} />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-6 py-2 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">Add</button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No artists found.</p>}
        {filtered.map((a) => (
          <div key={a.id} className="border border-border bg-card overflow-hidden">
            {/* Artist Header */}
            <div
              className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors"
              onClick={() => toggleExpand(a.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-sm truncate">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{timeSince(a.created_at)}</span>
                  {(activities[a.id]?.length ?? 0) > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">
                      {activities[a.id].length} activities
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {a.genre && <span className="flex items-center gap-1"><Music size={10} />{a.genre}</span>}
                  {a.email && <span className="flex items-center gap-1"><Mail size={10} />{a.email}</span>}
                  {a.phone && <span className="flex items-center gap-1"><Phone size={10} />{a.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={a.status}
                  onChange={(e) => { e.stopPropagation(); updateStatus(a.id, e.target.value, a.status); }}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-xs px-3 py-1 border rounded-sm bg-transparent cursor-pointer outline-none ${statusColor[a.status] || "border-border"}`}
                >
                  {STATUSES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
                </select>
                {expandedId === a.id ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </div>

            {/* Expanded Panel */}
            {expandedId === a.id && (
              <div className="border-t border-border bg-secondary/10 p-4">
                {/* Quick Info */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {a.music_link && (
                    <a href={a.music_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink size={10} /> Music Link
                    </a>
                  )}
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText size={10} /> Submission File
                    </a>
                  )}
                  {a.notes && (
                    <span className="text-xs text-muted-foreground italic">"{a.notes}"</span>
                  )}
                </div>

                {/* Add Activity */}
                {activityForm?.artistId === a.id ? (
                  <div className="border border-border bg-card p-3 mb-4 space-y-2">
                    <div className="flex gap-2">
                      {ACTIVITY_TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => setActivityForm({ ...activityForm, type: t })}
                          className={`text-[10px] uppercase tracking-widest px-2 py-1 border transition-colors ${
                            activityForm.type === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
                          }`}
                        >
                          {activityLabel[t]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder={`Log ${activityLabel[activityForm.type]} details...`}
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      className="w-full bg-secondary/30 border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button onClick={addActivity} className="bg-primary text-primary-foreground px-4 py-1.5 text-xs uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity">Log</button>
                      <button onClick={() => setActivityForm(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setActivityForm({ artistId: a.id, type: "note", description: "" })}
                    className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mb-4"
                  >
                    <Plus size={12} /> Log Activity
                  </button>
                )}

                {/* Activity Timeline */}
                <div className="space-y-0">
                  {(!activities[a.id] || activities[a.id].length === 0) && (
                    <p className="text-xs text-muted-foreground">No activities logged yet.</p>
                  )}
                  {activities[a.id]?.map((act, i) => {
                    const Icon = activityIcon[act.activity_type] || MessageSquare;
                    return (
                      <div key={act.id} className="flex gap-3 relative">
                        {/* Timeline line */}
                        {i < (activities[a.id]?.length ?? 0) - 1 && (
                          <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
                        )}
                        <div className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0 mt-0.5 z-10">
                          <Icon size={10} className="text-primary" />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                              {activityLabel[act.activity_type] || act.activity_type}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(act.created_at)}</span>
                          </div>
                          <p className="text-xs text-foreground/80">{act.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtistPipeline;
