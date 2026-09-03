import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  action: string;
  entity_type: string;
  summary: string | null;
  actor_email: string | null;
  actor_role: string | null;
  created_at: string;
};

/** Founder oversight — every action LERATO (coordinator) takes. */
const CoordinatorAuditLog = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from("action_log")
        .select("id, action, entity_type, summary, actor_email, actor_role, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={15} className="text-primary" />
        <p className="text-xs uppercase tracking-widest text-primary">Coordinator activity (LERATO)</p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No coordinator actions logged yet.</p>
      ) : (
        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="py-2">
              <p className="text-sm">{r.summary ?? r.action}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {r.action} · {r.entity_type} · {r.actor_email ?? r.actor_role ?? "—"} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoordinatorAuditLog;
