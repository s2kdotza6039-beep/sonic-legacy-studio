import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Inbox, RefreshCw, Check, Archive } from "lucide-react";

type Enquiry = {
  id: string;
  full_name: string;
  email: string;
  department: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

const STATUSES = ["all", "new", "handled", "archived"] as const;

const EnquiryDesk = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_enquiries")
      .select("id, full_name, email, department, subject, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't load enquiries", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as Enquiry[]);
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("contact_enquiries_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_enquiries" }, () => fetchRows())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contact_enquiries").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Couldn't update this enquiry", description: error.message, variant: "destructive" });
      return;
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
  };

  const visible = filter === "all" ? rows : rows.filter(r => r.status === filter);
  const newCount = rows.filter(r => r.status === "new").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Inbox size={18} className="text-primary" />
          <h2 className="text-xl font-display font-bold">Enquiry Desk</h2>
          {newCount > 0 && (
            <span className="text-[10px] uppercase tracking-widest bg-primary/15 text-primary px-2 py-1 rounded-full">
              {newCount} new
            </span>
          )}
        </div>
        <button
          onClick={fetchRows}
          className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary border border-border px-3 py-2"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-colors ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "border border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading enquiries…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enquiries here yet.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="border border-border bg-card/50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.full_name} ·{" "}
                    <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a> · {r.department}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest border border-border px-2 py-1">{r.status}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.message}</p>
              <div className="flex gap-2 pt-1">
                {r.status !== "handled" && (
                  <button
                    onClick={() => setStatus(r.id, "handled")}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary border border-border px-2 py-1"
                  >
                    <Check size={11} /> Mark handled
                  </button>
                )}
                {r.status !== "archived" && (
                  <button
                    onClick={() => setStatus(r.id, "archived")}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive border border-border px-2 py-1"
                  >
                    <Archive size={11} /> Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnquiryDesk;
