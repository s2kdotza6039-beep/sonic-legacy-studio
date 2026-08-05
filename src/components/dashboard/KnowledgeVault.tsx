import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, X, Pencil, Eye, EyeOff, BookLock } from "lucide-react";

type Entry = {
  id: string;
  category: string;
  title: string;
  body: string;
  is_constitutional: boolean;
  priority: number;
  active: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  mission: "Mission",
  vision: "Vision",
  core_values: "Core Values",
  founder_principles: "Founder Principles",
  things_we_always_do: "Things We Always Do",
  things_we_never_do: "Things We Never Do",
  non_negotiables: "Non-Negotiables",
  partner_disqualifications: "Partner Disqualifications",
  institutional_principles: "Institutional Principles",
  strategic_objectives: "Strategic Objectives",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const emptyDraft = {
  category: "mission",
  title: "",
  body: "",
  is_constitutional: true,
  priority: 0,
  active: true,
};

const KnowledgeVault = () => {
  const { isFounder } = useUserRole();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_vault")
      .select("*")
      .order("category", { ascending: true })
      .order("priority", { ascending: true });
    if (error) toast({ title: "Failed to load vault", description: error.message, variant: "destructive" });
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const startEdit = (e: Entry) => {
    setCreating(false);
    setEditingId(e.id);
    setDraft({
      category: e.category,
      title: e.title,
      body: e.body ?? "",
      is_constitutional: e.is_constitutional,
      priority: e.priority,
      active: e.active,
    });
  };

  const startCreate = (category?: string) => {
    setEditingId(null);
    setCreating(true);
    setDraft({ ...emptyDraft, category: category ?? "mission" });
  };

  const cancel = () => {
    setEditingId(null);
    setCreating(false);
    setDraft(emptyDraft);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const payload = { ...draft, title: draft.title.trim(), body: draft.body };
    const { error } = editingId
      ? await supabase.from("knowledge_vault").update(payload).eq("id", editingId)
      : await supabase.from("knowledge_vault").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Entry updated" : "Entry added" });
    cancel();
    fetchEntries();
  };

  const toggleActive = async (e: Entry) => {
    const { error } = await supabase.from("knowledge_vault").update({ active: !e.active }).eq("id", e.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    fetchEntries();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("knowledge_vault").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Entry deleted" });
    fetchEntries();
  };

  const categories = Array.from(
    new Set([...CATEGORY_ORDER.filter((c) => entries.some((e) => e.category === c)), ...entries.map((e) => e.category)])
  );

  const editor = (
    <div className="border border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="bg-background border border-border text-xs px-3 py-2 text-foreground"
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <Input
          type="number"
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
          placeholder="Priority"
          className="text-xs"
        />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.is_constitutional}
              onChange={(e) => setDraft({ ...draft, is_constitutional: e.target.checked })}
            />
            Constitutional
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Active
          </label>
        </div>
      </div>
      <Input
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Title"
        className="text-sm"
      />
      <Textarea
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder="Body / meaning (optional)"
        className="text-sm min-h-[90px]"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="gap-1 text-xs">
          <Save size={12} /> Save
        </Button>
        <Button size="sm" variant="outline" onClick={cancel} className="gap-1 text-xs">
          <X size={12} /> Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <BookLock size={16} className="text-primary" />
          <div>
            <h2 className="text-sm uppercase tracking-widest text-primary">Knowledge Vault</h2>
            <p className="text-xs text-muted-foreground">Founder Constitution — {entries.length} entries</p>
          </div>
        </div>
        {isFounder && !creating && (
          <Button size="sm" onClick={() => startCreate()} className="gap-1 text-xs">
            <Plus size={12} /> New Entry
          </Button>
        )}
      </div>

      {creating && editor}

      {loading && <p className="text-xs text-muted-foreground">Loading vault...</p>}
      {!loading && entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No entries yet.</p>
      )}

      {categories.map((cat) => {
        const items = entries.filter((e) => e.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="border border-border">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/40">
              <h3 className="text-xs uppercase tracking-widest text-foreground">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="divide-y divide-border">
              {items.map((e) =>
                editingId === e.id ? (
                  <div key={e.id} className="p-3">
                    {editor}
                  </div>
                ) : (
                  <div
                    key={e.id}
                    className={`group px-4 py-3 flex items-start justify-between gap-4 ${
                      e.active ? "" : "opacity-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{e.title}</p>
                        {e.is_constitutional && (
                          <span className="text-[10px] uppercase tracking-widest border border-primary/40 text-primary px-1.5 py-0.5">
                            Constitutional
                          </span>
                        )}
                        {!e.active && (
                          <span className="text-[10px] uppercase tracking-widest border border-border text-muted-foreground px-1.5 py-0.5">
                            Off
                          </span>
                        )}
                      </div>
                      {e.body && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.body}</p>
                      )}
                    </div>
                    {isFounder && (
                      <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleActive(e)}
                          title={e.active ? "Turn off" : "Turn on"}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {e.active ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          onClick={() => startEdit(e)}
                          title="Edit"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => remove(e.id)}
                          title="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KnowledgeVault;
