import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, RefreshCw } from "lucide-react";

type Memory = { id: string; key: string; value: string; category: string; source: string; updated_at: string };

const SydneyMemoryPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Memory[]>([]);
  const [edit, setEdit] = useState<Record<string, { key?: string; value?: string; category?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("sydney_memory").select("*").order("updated_at", { ascending: false }).limit(500);
    if (error) toast({ title: "Could not load memory", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Memory[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("ceo_diary_memory")
      .on("postgres_changes", { event: "*", schema: "public", table: "sydney_memory" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const save = async (m: Memory) => {
    const e = edit[m.id] ?? {};
    const patch = { key: (e.key ?? m.key).trim(), value: e.value ?? m.value, category: (e.category ?? m.category).trim() || "general" };
    if (!patch.key) { toast({ title: "Key can't be empty", variant: "destructive" }); return; }
    const { error } = await supabase.from("sydney_memory").update(patch).eq("id", m.id);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    setEdit((p) => { const n = { ...p }; delete n[m.id]; return n; });
    toast({ title: "Memory updated" });
    load();
  };

  const remove = async (m: Memory) => {
    if (!confirm(`Delete memory "${m.key}"?`)) return;
    const { error } = await supabase.from("sydney_memory").delete().eq("id", m.id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Memory removed" });
    load();
  };

  const f = filter.toLowerCase();
  const shown = rows.filter((r) => !f || `${r.key} ${r.value} ${r.category}`.toLowerCase().includes(f));

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search memory…" className="text-xs" />
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="text-xs gap-1">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {shown.map((m) => {
        const e = edit[m.id] ?? {};
        return (
          <Card key={m.id}>
            <CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input aria-label="Key" value={e.key ?? m.key} onChange={(ev) => setEdit((p) => ({ ...p, [m.id]: { ...p[m.id], key: ev.target.value } }))} className="h-8 text-xs sm:col-span-2" />
                <Input aria-label="Category" value={e.category ?? m.category} onChange={(ev) => setEdit((p) => ({ ...p, [m.id]: { ...p[m.id], category: ev.target.value } }))} className="h-8 text-xs" />
              </div>
              <Textarea aria-label="Value" value={e.value ?? m.value} onChange={(ev) => setEdit((p) => ({ ...p, [m.id]: { ...p[m.id], value: ev.target.value } }))} className="text-xs min-h-[60px]" />
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Source: {m.source} · Updated {new Date(m.updated_at).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => save(m)} className="text-xs gap-1"><Save size={12} /> Save</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(m)} className="text-xs gap-1"><Trash2 size={12} /> Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {!loading && shown.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No stored memory.</p>}
    </div>
  );
};

export default SydneyMemoryPanel;
