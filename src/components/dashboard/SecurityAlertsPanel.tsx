import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, Plus, Trash2, Send, Loader2 } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  event_source: "playback" | "payfast" | "ai" | "audit";
  event_kind: string;
  threshold: number;
  window_minutes: number;
  channel: "email" | "webhook";
  destination: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

const EMPTY: Omit<Rule, "id" | "last_triggered_at"> = {
  name: "",
  enabled: true,
  event_source: "playback",
  event_kind: "seek_blocked",
  threshold: 5,
  window_minutes: 15,
  channel: "email",
  destination: "",
  cooldown_minutes: 30,
};

export default function SecurityAlertsPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("security_alert_rules")
      .select("*")
      .order("created_at", { ascending: false });
    setRules((data as Rule[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name || !draft.destination) {
      alert("Name and destination are required");
      return;
    }
    if (draft.channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.destination)) {
      alert("Invalid email");
      return;
    }
    if (draft.channel === "webhook" && !draft.destination.startsWith("https://")) {
      alert("Webhook URL must use https://");
      return;
    }
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("security_alert_rules").insert({
      ...draft,
      created_by: s.session?.user?.id,
    });
    setBusy(false);
    if (error) return alert(error.message);
    setDraft(EMPTY);
    load();
  };

  const toggle = async (r: Rule) => {
    await supabase.from("security_alert_rules").update({ enabled: !r.enabled }).eq("id", r.id);
    load();
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    await supabase.from("security_alert_rules").delete().eq("id", r.id);
    load();
  };

  const runNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("process-security-alerts", {});
    setBusy(false);
    if (error) alert(error.message);
    else alert(`Processed: ${JSON.stringify(data)}`);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5" /> Security Alert Rules
          </CardTitle>
          <CardDescription>
            Notify by email or webhook when a security event exceeds a threshold within a window.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={runNow} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Run now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-border rounded-md bg-secondary/20">
          <Input placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="md:col-span-2" />
          <select className="px-2 py-1 text-sm bg-background border border-border rounded" value={draft.event_source} onChange={(e) => setDraft({ ...draft, event_source: e.target.value as Rule["event_source"] })}>
            <option value="playback">playback</option>
            <option value="payfast">payfast</option>
            <option value="ai">ai</option>
            <option value="audit">audit</option>
          </select>
          <Input placeholder="kind (or *)" value={draft.event_kind} onChange={(e) => setDraft({ ...draft, event_kind: e.target.value })} />
          <Input type="number" min={1} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} title="Threshold" />
          <Input type="number" min={1} value={draft.window_minutes} onChange={(e) => setDraft({ ...draft, window_minutes: Number(e.target.value) })} title="Window (min)" />
          <select className="px-2 py-1 text-sm bg-background border border-border rounded" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as Rule["channel"] })}>
            <option value="email">email</option>
            <option value="webhook">webhook</option>
          </select>
          <Input placeholder={draft.channel === "email" ? "alerts@you.com" : "https://hooks.example.com/..."} value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} className="md:col-span-3" />
          <Input type="number" min={1} value={draft.cooldown_minutes} onChange={(e) => setDraft({ ...draft, cooldown_minutes: Number(e.target.value) })} title="Cooldown (min)" />
          <Button onClick={create} disabled={busy}>
            <Plus className="w-4 h-4 mr-1" /> Add rule
          </Button>
        </div>

        {/* Rules table */}
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-2 text-left">On</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Source / Kind</th>
                <th className="p-2 text-left">Threshold / Window</th>
                <th className="p-2 text-left">Channel</th>
                <th className="p-2 text-left">Last fired</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && !loading && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No rules yet.</td></tr>
              )}
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2"><Switch checked={r.enabled} onCheckedChange={() => toggle(r)} /></td>
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 font-mono">{r.event_source} / {r.event_kind}</td>
                  <td className="p-2">≥ {r.threshold} in {r.window_minutes}m (cooldown {r.cooldown_minutes}m)</td>
                  <td className="p-2 font-mono">{r.channel}: {r.destination.slice(0, 40)}</td>
                  <td className="p-2 text-muted-foreground">{r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : "—"}</td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></Button>
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
