import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, Plus, Trash2, Send, Loader2, Save, Pencil, X, Repeat, Database, FlaskConical, Settings2 } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  event_source: "playback" | "payfast" | "ai" | "audit" | "delivery_meta";
  event_kind: string;
  threshold: number;
  window_minutes: number;
  channel: "email" | "webhook";
  destination: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

const META_KINDS = ["delivery_spike", "retry_rate_high", "dlq_rate_high"] as const;
const SOURCE_OPTIONS = ["playback", "payfast", "ai", "audit", "delivery_meta"] as const;

type DlqRow = {
  id: string;
  rule_name: string | null;
  channel: string | null;
  destination: string | null;
  matched_count: number | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

type Retention = {
  audit_log_days: number;
  dispatch_log_days: number;
  dlq_days: number;
  cleanup_enabled: boolean;
  last_cleanup_at: string | null;
  last_cleanup_summary: Record<string, unknown> | null;
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

const validateDestination = (channel: Rule["channel"], dest: string) => {
  if (channel === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest);
  return dest.startsWith("https://");
};

export default function SecurityAlertsPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [dlq, setDlq] = useState<DlqRow[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, d, c] = await Promise.all([
      supabase.from("security_alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("security_alert_dlq").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("security_retention_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    setRules((r.data as Rule[]) ?? []);
    setDlq((d.data as DlqRow[]) ?? []);
    setRetention((c.data as Retention) ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name || !draft.destination) return alert("Name and destination are required");
    if (!validateDestination(draft.channel, draft.destination)) {
      return alert(draft.channel === "email" ? "Invalid email" : "Webhook URL must use https://");
    }
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("security_alert_rules").insert({ ...draft, created_by: s.session?.user?.id });
    setBusy(false);
    if (error) return alert(error.message);
    setDraft(EMPTY);
    load();
  };

  const startEdit = (r: Rule) => { setEditingId(r.id); setEditDraft({ ...r }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = async () => {
    if (!editDraft) return;
    if (!validateDestination(editDraft.channel, editDraft.destination)) {
      return alert(editDraft.channel === "email" ? "Invalid email" : "Webhook URL must use https://");
    }
    const { id, last_triggered_at: _lt, ...patch } = editDraft;
    void _lt;
    const { error } = await supabase.from("security_alert_rules").update(patch).eq("id", id);
    if (error) return alert(error.message);
    cancelEdit();
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

  const runNow = async (mode: "scan" | "retry") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("process-security-alerts", {
      body: mode === "retry" ? { mode: "retry" } : {},
    });
    setBusy(false);
    if (error) alert(error.message);
    else alert(`${mode === "retry" ? "Retried" : "Scanned"}: ${JSON.stringify(data)}`);
    load();
  };

  const purgeDlqRow = async (id: string) => {
    if (!confirm("Delete this dead-letter entry?")) return;
    await supabase.from("security_alert_dlq").delete().eq("id", id);
    load();
  };

  const saveRetention = async () => {
    if (!retention) return;
    const { error } = await supabase.from("security_retention_config").update({
      audit_log_days: retention.audit_log_days,
      dispatch_log_days: retention.dispatch_log_days,
      dlq_days: retention.dlq_days,
      cleanup_enabled: retention.cleanup_enabled,
    }).eq("id", 1);
    if (error) return alert(error.message);
    alert("Retention saved.");
  };

  const runCleanup = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("security-retention-cleanup", {});
    setBusy(false);
    if (error) alert(error.message);
    else alert(`Cleanup result: ${JSON.stringify(data)}`);
    load();
  };

  // --- Dry-run "Test this rule": evaluates a single rule WITHOUT dispatching. ---
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const testRule = async (r: Rule) => {
    setTestingId(r.id);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("process-security-alerts", {
      body: { mode: "dryrun", rule_id: r.id },
    });
    setTestingId(null);
    if (error) { alert(error.message); return; }
    const result = (data as { results?: Record<string, unknown>[] })?.results?.[0] ?? null;
    setTestResult({ ...result, _rule: r.name });
  };

  // --- Channel defaults: bulk-apply cooldown across all rules of a given channel. ---
  const [emailCooldown, setEmailCooldown] = useState<number>(30);
  const [webhookCooldown, setWebhookCooldown] = useState<number>(15);
  const [defaultEmailDest, setDefaultEmailDest] = useState("");
  const [defaultWebhookDest, setDefaultWebhookDest] = useState("");
  const applyChannelCooldown = async (channel: Rule["channel"], minutes: number) => {
    if (minutes < 0 || !Number.isFinite(minutes)) return alert("Cooldown must be ≥ 0");
    if (!confirm(`Apply cooldown ${minutes} min to ALL ${channel} rules?`)) return;
    setBusy(true);
    const { error } = await supabase.from("security_alert_rules")
      .update({ cooldown_minutes: minutes }).eq("channel", channel);
    setBusy(false);
    if (error) return alert(error.message);
    load();
  };
  const applyChannelDestination = async (channel: Rule["channel"], dest: string) => {
    if (!validateDestination(channel, dest)) {
      return alert(channel === "email" ? "Invalid email" : "Webhook URL must use https://");
    }
    if (!confirm(`Redirect ALL ${channel} rules to ${dest}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("security_alert_rules")
      .update({ destination: dest }).eq("channel", channel);
    setBusy(false);
    if (error) return alert(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      {/* Alert rules */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" /> Security Alert Rules
            </CardTitle>
            <CardDescription>
              Per-rule thresholds, time windows, and cooldowns. Failed deliveries retry with
              exponential backoff (1m → 2m → 4m → 8m → 16m) and land in the DLQ after 5 attempts.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => runNow("retry")} disabled={busy}>
              <Repeat className="w-4 h-4 mr-1" /> Retry failed
            </Button>
            <Button variant="outline" size="sm" onClick={() => runNow("scan")} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Scan now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-border rounded-md bg-secondary/20">
            <Input placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="md:col-span-2" />
            <select className="px-2 py-1 text-sm bg-background border border-border rounded" value={draft.event_source} onChange={(e) => setDraft({ ...draft, event_source: e.target.value as Rule["event_source"], event_kind: e.target.value === "delivery_meta" ? "delivery_spike" : draft.event_kind })}>
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {draft.event_source === "delivery_meta" ? (
              <select className="px-2 py-1 text-sm bg-background border border-border rounded" value={draft.event_kind} onChange={(e) => setDraft({ ...draft, event_kind: e.target.value })}>
                {META_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            ) : (
              <Input placeholder="kind (or *)" value={draft.event_kind} onChange={(e) => setDraft({ ...draft, event_kind: e.target.value })} />
            )}
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

          {/* Rules table with inline edit */}
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-2 text-left">On</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Source / Kind</th>
                  <th className="p-2 text-left">Threshold</th>
                  <th className="p-2 text-left">Window (m)</th>
                  <th className="p-2 text-left">Cooldown (m)</th>
                  <th className="p-2 text-left">Channel · Destination</th>
                  <th className="p-2 text-left">Last fired</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && !loading && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No rules yet.</td></tr>
                )}
                {rules.map((r) => {
                  const isEdit = editingId === r.id && editDraft;
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-2"><Switch checked={r.enabled} onCheckedChange={() => toggle(r)} disabled={!!isEdit} /></td>
                      <td className="p-2 font-medium">
                        {isEdit ? <Input className="h-7 text-xs" value={editDraft!.name} onChange={(e) => setEditDraft({ ...editDraft!, name: e.target.value })} /> : r.name}
                      </td>
                      <td className="p-2 font-mono">
                        {isEdit ? (
                          <div className="flex gap-1">
                            <select className="px-1 py-0.5 text-xs bg-background border border-border rounded" value={editDraft!.event_source} onChange={(e) => setEditDraft({ ...editDraft!, event_source: e.target.value as Rule["event_source"], event_kind: e.target.value === "delivery_meta" ? "delivery_spike" : editDraft!.event_kind })}>
                              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {editDraft!.event_source === "delivery_meta" ? (
                              <select className="px-1 py-0.5 text-xs bg-background border border-border rounded" value={editDraft!.event_kind} onChange={(e) => setEditDraft({ ...editDraft!, event_kind: e.target.value })}>
                                {META_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                              </select>
                            ) : (
                              <Input className="h-7 text-xs w-28" value={editDraft!.event_kind} onChange={(e) => setEditDraft({ ...editDraft!, event_kind: e.target.value })} />
                            )}
                          </div>
                        ) : `${r.event_source} / ${r.event_kind}`}
                      </td>
                      <td className="p-2">
                        {isEdit ? <Input className="h-7 text-xs w-20" type="number" min={1} value={editDraft!.threshold} onChange={(e) => setEditDraft({ ...editDraft!, threshold: Number(e.target.value) })} /> : r.threshold}
                      </td>
                      <td className="p-2">
                        {isEdit ? <Input className="h-7 text-xs w-20" type="number" min={1} value={editDraft!.window_minutes} onChange={(e) => setEditDraft({ ...editDraft!, window_minutes: Number(e.target.value) })} /> : r.window_minutes}
                      </td>
                      <td className="p-2">
                        {isEdit ? <Input className="h-7 text-xs w-20" type="number" min={1} value={editDraft!.cooldown_minutes} onChange={(e) => setEditDraft({ ...editDraft!, cooldown_minutes: Number(e.target.value) })} /> : r.cooldown_minutes}
                      </td>
                      <td className="p-2 font-mono">
                        {isEdit ? (
                          <div className="flex gap-1">
                            <select className="px-1 py-0.5 text-xs bg-background border border-border rounded" value={editDraft!.channel} onChange={(e) => setEditDraft({ ...editDraft!, channel: e.target.value as Rule["channel"] })}>
                              <option value="email">email</option>
                              <option value="webhook">webhook</option>
                            </select>
                            <Input className="h-7 text-xs flex-1" value={editDraft!.destination} onChange={(e) => setEditDraft({ ...editDraft!, destination: e.target.value })} />
                          </div>
                        ) : `${r.channel}: ${r.destination.slice(0, 40)}`}
                      </td>
                      <td className="p-2 text-muted-foreground">{r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : "—"}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {isEdit ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={saveEdit}><Save className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dead-letter queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="w-4 h-4" /> Dead-letter queue ({dlq.length})
          </CardTitle>
          <CardDescription>Alerts that failed every retry. Investigate the error, then delete.</CardDescription>
        </CardHeader>
        <CardContent>
          {dlq.length === 0 ? (
            <p className="text-xs text-muted-foreground">No dead-lettered alerts.</p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="p-2 text-left">When</th>
                    <th className="p-2 text-left">Rule</th>
                    <th className="p-2 text-left">Channel</th>
                    <th className="p-2 text-left">Matched</th>
                    <th className="p-2 text-left">Attempts</th>
                    <th className="p-2 text-left">Last error</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dlq.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-2">{r.rule_name}</td>
                      <td className="p-2 font-mono">{r.channel}: {r.destination?.slice(0, 32)}</td>
                      <td className="p-2">{r.matched_count}</td>
                      <td className="p-2">{r.attempts}</td>
                      <td className="p-2 text-rose-600 dark:text-rose-400">{r.last_error}</td>
                      <td className="p-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => purgeDlqRow(r.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retention */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4" /> Retention & cleanup
            </CardTitle>
            <CardDescription>
              Configure how long audit, dispatch, and DLQ rows are kept. A scheduled cleanup runs daily.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runCleanup} disabled={busy || !retention}>Run cleanup now</Button>
            <Button size="sm" onClick={saveRetention} disabled={busy || !retention}>Save</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!retention ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Audit log (days)</span>
                <Input type="number" min={1} value={retention.audit_log_days} onChange={(e) => setRetention({ ...retention, audit_log_days: Number(e.target.value) })} />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Dispatch log (days)</span>
                <Input type="number" min={1} value={retention.dispatch_log_days} onChange={(e) => setRetention({ ...retention, dispatch_log_days: Number(e.target.value) })} />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">DLQ (days)</span>
                <Input type="number" min={1} value={retention.dlq_days} onChange={(e) => setRetention({ ...retention, dlq_days: Number(e.target.value) })} />
              </label>
              <label className="text-xs flex items-center gap-2">
                <Switch checked={retention.cleanup_enabled} onCheckedChange={(v) => setRetention({ ...retention, cleanup_enabled: v })} />
                <span>Cleanup enabled</span>
              </label>
              <p className="md:col-span-4 text-xs text-muted-foreground">
                Last cleanup: {retention.last_cleanup_at ? new Date(retention.last_cleanup_at).toLocaleString() : "never"}
                {retention.last_cleanup_summary && (
                  <> · summary: <code className="font-mono">{JSON.stringify(retention.last_cleanup_summary)}</code></>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
