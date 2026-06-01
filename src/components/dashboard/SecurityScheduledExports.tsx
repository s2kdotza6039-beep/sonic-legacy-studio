import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Loader2, Play, Plus, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type Schedule = {
  id: string;
  owner_user_id: string;
  name: string;
  cadence: "daily" | "weekly";
  lookback_hours: number;
  filters: Record<string, unknown>;
  delivery_method: "email" | "webhook";
  destination: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_row_count: number | null;
};

type Run = {
  id: string;
  schedule_id: string;
  started_at: string;
  finished_at: string | null;
  status: "queued" | "sent" | "failed";
  retry_count: number;
  row_count: number | null;
  delivery_method: string | null;
  destination: string | null;
  error_message: string | null;
};

type Draft = {
  name: string;
  cadence: "daily" | "weekly";
  lookback_hours: number;
  delivery_method: "email" | "webhook";
  destination: string;
  filters_action: string;
  filters_destination: string;
};
const EMPTY: Draft = {
  name: "",
  cadence: "daily",
  lookback_hours: 24,
  delivery_method: "email",
  destination: "",
  filters_action: "all",
  filters_destination: "",
};

const validateDest = (m: "email" | "webhook", d: string) =>
  m === "email" ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d) : d.startsWith("https://");

export default function SecurityScheduledExports() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("security_scheduled_exports").select("*").order("created_at", { ascending: false });
    setRows((data as Schedule[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name.trim()) return alert("Name required");
    if (!validateDest(draft.delivery_method, draft.destination)) {
      return alert(draft.delivery_method === "email" ? "Invalid email" : "HTTPS URL required");
    }
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) { setBusy(false); return alert("Sign in"); }
    const { error } = await supabase.from("security_scheduled_exports").insert({
      owner_user_id: uid,
      name: draft.name.trim(),
      cadence: draft.cadence,
      lookback_hours: Math.max(1, Math.min(720, draft.lookback_hours)),
      delivery_method: draft.delivery_method,
      destination: draft.destination.trim(),
      filters: { action: draft.filters_action, destination: draft.filters_destination.trim() },
    });
    setBusy(false);
    if (error) return alert(error.message);
    setDraft(EMPTY);
    load();
  };

  const toggle = async (r: Schedule) => {
    const { error } = await supabase.from("security_scheduled_exports").update({ enabled: !r.enabled }).eq("id", r.id);
    if (error) alert(error.message); else load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this scheduled export?")) return;
    const { error } = await supabase.from("security_scheduled_exports").delete().eq("id", id);
    if (error) alert(error.message); else load();
  };

  const runNow = async (id: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("security-scheduled-export", { body: { schedule_id: id, force: true } });
      if (error) throw error;
      const r = (data?.results?.[0] ?? {}) as { rows?: number; delivery_ok?: boolean; delivery_error?: string };
      alert(r.delivery_ok ? `Delivered ${r.rows ?? 0} rows.` : `Delivery failed: ${r.delivery_error ?? "unknown"}`);
      load();
    } catch (e) {
      alert("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Scheduled audit exports</CardTitle>
          <CardDescription>
            Configure daily or weekly CSV exports of <code>security_audit_log</code>. Each run is audited as
            a <code>csv_export</code> entry with <code>metadata.source = "scheduled_export"</code>.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-dashed border-border rounded-md">
          <Input className="h-8 text-xs md:col-span-2" placeholder="Schedule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className="px-2 py-1.5 text-xs bg-background border border-border rounded" value={draft.cadence} onChange={(e) => setDraft({ ...draft, cadence: e.target.value as "daily" | "weekly" })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <Input className="h-8 text-xs" type="number" min={1} max={720} placeholder="Lookback h" value={draft.lookback_hours} onChange={(e) => setDraft({ ...draft, lookback_hours: Number(e.target.value) })} />
          <select className="px-2 py-1.5 text-xs bg-background border border-border rounded" value={draft.delivery_method} onChange={(e) => setDraft({ ...draft, delivery_method: e.target.value as "email" | "webhook" })}>
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
          <Input className="h-8 text-xs" placeholder={draft.delivery_method === "email" ? "you@domain.com" : "https://hook.example/…"} value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
          <Input className="h-8 text-xs md:col-span-2" placeholder="Filter: action (e.g. csv_export, alert_rule_dryrun, all)" value={draft.filters_action} onChange={(e) => setDraft({ ...draft, filters_action: e.target.value })} />
          <Input className="h-8 text-xs md:col-span-3" placeholder="Filter: destination contains…" value={draft.filters_destination} onChange={(e) => setDraft({ ...draft, filters_destination: e.target.value })} />
          <Button size="sm" onClick={create} disabled={busy}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Cadence</th>
                <th className="text-left p-2">Lookback</th>
                <th className="text-left p-2">Delivery</th>
                <th className="text-left p-2">Last run</th>
                <th className="text-left p-2">On</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No scheduled exports.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2">{r.cadence}</td>
                  <td className="p-2">{r.lookback_hours}h</td>
                  <td className="p-2 font-mono truncate max-w-[220px]" title={r.destination}>{r.delivery_method}: {r.destination}</td>
                  <td className="p-2">
                    {r.last_run_at ? (
                      <div>
                        <div>{new Date(r.last_run_at).toLocaleString()}</div>
                        <div className={`text-[10px] ${r.last_status === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
                          {r.last_status ?? "—"} · {r.last_row_count ?? 0} rows
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground">never</span>}
                  </td>
                  <td className="p-2"><Switch checked={r.enabled} onCheckedChange={() => toggle(r)} /></td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => runNow(r.id)} disabled={busy}><Play className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
