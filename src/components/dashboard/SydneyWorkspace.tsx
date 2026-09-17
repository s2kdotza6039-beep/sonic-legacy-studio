import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, RefreshCw, AlertTriangle, Trash2, Save, Clock, History, Brain } from "lucide-react";

type Pending = {
  id: string; action_kind: string; tier: number; summary: string; risk: string | null;
  status: string; changes: any; expires_at: string; created_at: string; result: any;
};
type LogRow = {
  id: string; action: string; entity_type: string; entity_id: string | null; location: string | null;
  summary: string | null; result: string | null; created_at: string;
  before_snapshot: any; after_snapshot: any;
};
type Memory = {
  id: string; key: string; value: string; category: string; source: string; updated_at: string;
};

const SydneyWorkspace = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [memory, setMemory] = useState<Memory[]>([]);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [p, l, m] = await Promise.all([
      supabase.from("assistant_pending_actions").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("sydney_action_log").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("sydney_memory").select("*").order("updated_at", { ascending: false }).limit(200),
    ]);
    const firstError = p.error || l.error || m.error;
    if (firstError) setError(firstError.message);
    setPending((p.data ?? []) as Pending[]);
    setLogs((l.data ?? []) as LogRow[]);
    setMemory((m.data ?? []) as Memory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("sydney_workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "sydney_action_log" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "assistant_pending_actions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sydney_memory" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const cancelAction = async (id: string) => {
    const { error: e } = await supabase
      .from("assistant_pending_actions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (e) { toast({ title: "Could not cancel", description: e.message, variant: "destructive" }); return; }
    toast({ title: "Pending action cancelled" });
    load();
  };

  const saveMemory = async (m: Memory) => {
    const value = edit[m.id] ?? m.value;
    const { error: e } = await supabase.from("sydney_memory").update({ value }).eq("id", m.id);
    if (e) { toast({ title: "Could not save", description: e.message, variant: "destructive" }); return; }
    toast({ title: "Memory updated" });
    load();
  };

  const deleteMemory = async (id: string) => {
    const { error: e } = await supabase.from("sydney_memory").delete().eq("id", id);
    if (e) { toast({ title: "Could not delete", description: e.message, variant: "destructive" }); return; }
    toast({ title: "Memory removed" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-primary" />
          <h2 className="text-xl font-display font-bold">Sydney</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="text-xs gap-1">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-secondary/30">
          <TabsTrigger value="pending" className="text-xs gap-1"><Clock size={12} /> Pending Actions</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1"><History size={12} /> Activity</TabsTrigger>
          <TabsTrigger value="memory" className="text-xs gap-1"><Brain size={12} /> Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">
            Actions Sydney prepared but has not performed. She only executes these after you say "Confirm" in chat.
          </p>
          {pending.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <p className="text-sm font-medium">{p.summary}</p>
                  <span className={`text-[10px] uppercase tracking-widest ${p.status === "pending" ? "text-yellow-400" : p.status === "executed" ? "text-emerald-400" : "text-muted-foreground"}`}>
                    Tier {p.tier} · {p.status}
                  </span>
                </div>
                {p.risk && <p className="text-[11px] text-muted-foreground">Risk: {p.risk}</p>}
                <p className="text-[10px] text-muted-foreground">
                  {p.action_kind} · expires {new Date(p.expires_at).toLocaleString()} · id {p.id.slice(0, 8)}
                </p>
                {p.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => cancelAction(p.id)} className="text-xs mt-1">Cancel</Button>
                )}
              </CardContent>
            </Card>
          ))}
          {!loading && pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nothing waiting for your confirmation.</p>}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2 mt-4">
          {logs.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3">
                <button onClick={() => setOpenLog(openLog === l.id ? null : l.id)} className="w-full text-left">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <p className="text-sm">{l.summary || l.action}</p>
                    <span className={`text-[10px] uppercase tracking-widest ${l.result === "success" ? "text-emerald-400" : "text-destructive"}`}>{l.result}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()} · {l.location || l.entity_type}
                    {l.entity_id ? ` · id ${String(l.entity_id).slice(0, 8)}` : ""}
                  </p>
                </button>
                {openLog === l.id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <pre className="text-[10px] bg-secondary/40 p-2 overflow-auto max-h-48">{JSON.stringify(l.before_snapshot, null, 2)}</pre>
                    <pre className="text-[10px] bg-secondary/40 p-2 overflow-auto max-h-48">{JSON.stringify(l.after_snapshot, null, 2)}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!loading && logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sydney hasn't changed anything yet.</p>}
        </TabsContent>

        <TabsContent value="memory" className="space-y-2 mt-4">
          {memory.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <Input value={m.key} readOnly className="h-8 text-xs max-w-[280px]" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.category} · {m.source} · {new Date(m.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <Textarea
                  value={edit[m.id] ?? m.value}
                  onChange={(e) => setEdit((p) => ({ ...p, [m.id]: e.target.value }))}
                  className="text-xs min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMemory(m)} className="text-xs gap-1"><Save size={12} /> Save</Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMemory(m.id)} className="text-xs gap-1"><Trash2 size={12} /> Remove</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && memory.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No stored memory yet.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SydneyWorkspace;
