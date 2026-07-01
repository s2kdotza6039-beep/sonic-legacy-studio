import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Eye, EyeOff, Plus, Save, Search, Star, Trash2 } from "lucide-react";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string | null;
  priority: number | null;
  tags: string[] | null;
  is_active_context: boolean | null;
  updated_at: string | null;
  created_at: string | null;
}

type FormState = {
  title: string;
  category: string;
  priority: string;
  tags: string;
  content: string;
  is_active_context: boolean;
};

const CATEGORY_OPTIONS = ["general", "business", "artist", "procedure", "style", "launch", "personal"];

const categoryStyles: Record<string, string> = {
  business: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  artist: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  procedure: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  launch: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  personal: "bg-slate-500/15 text-slate-300 border-slate-500/25",
  general: "bg-muted text-muted-foreground border-border",
};

const emptyForm = (): FormState => ({
  title: "",
  category: "general",
  priority: "5",
  tags: "",
  content: "",
  is_active_context: true,
});

const FounderKnowledgeVault = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("founder_knowledge")
      .select("*")
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Unable to load knowledge", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const list = (data as KnowledgeEntry[]) || [];
    setEntries(list);
    if (!selectedId && list.length > 0) {
      const first = list[0];
      setSelectedId(first.id);
      setForm({
        title: first.title || "",
        category: first.category || "general",
        priority: String(first.priority ?? 5),
        tags: (first.tags || []).join(", "),
        content: first.content || "",
        is_active_context: Boolean(first.is_active_context),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      const text = `${entry.title} ${entry.content} ${(entry.tags || []).join(" ")}`.toLowerCase();
      const matchesSearch = !search || text.includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || (entry.category || "general") === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [entries, search, categoryFilter]);

  const selectEntry = (entry: KnowledgeEntry) => {
    setSelectedId(entry.id);
    setForm({
      title: entry.title || "",
      category: entry.category || "general",
      priority: String(entry.priority ?? 5),
      tags: (entry.tags || []).join(", "),
      content: entry.content || "",
      is_active_context: Boolean(entry.is_active_context),
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", description: "Add a title before saving.", variant: "destructive" });
      return;
    }

    const parsedTags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: form.title.trim(),
      category: form.category,
      priority: Number(form.priority) || 0,
      tags: parsedTags,
      content: form.content.trim(),
      is_active_context: form.is_active_context,
    };

    const { error } = selectedId
      ? await supabase.from("founder_knowledge").update(payload).eq("id", selectedId)
      : await supabase.from("founder_knowledge").insert(payload);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: selectedId ? "Entry updated" : "Entry created" });
    await loadEntries();
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const confirmed = window.confirm("Delete this knowledge entry?");
    if (!confirmed) return;

    const { error } = await supabase.from("founder_knowledge").delete().eq("id", selectedId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Entry deleted" });
    setSelectedId(null);
    setForm(emptyForm());
    await loadEntries();
  };

  const activeCount = entries.filter((entry) => entry.is_active_context).length;

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-primary" />
            <h3 className="text-sm uppercase tracking-widest font-bold">Founder Knowledge Vault</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {entries.length} entries • {activeCount} active in AI context
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={resetForm}>
          <Plus size={14} /> New Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.4fr]">
        <div className="border-b lg:border-b-0 lg:border-r border-border p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {loading && <div className="text-sm text-muted-foreground">Loading knowledge…</div>}
            {!loading && visibleEntries.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No matching knowledge yet.
              </div>
            )}
            {!loading && visibleEntries.map((entry) => {
              const categoryKey = (entry.category || "general").toLowerCase();
              const categoryClass = categoryStyles[categoryKey] || categoryStyles.general;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectEntry(entry)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === entry.id ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/40"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entry.title || "Untitled entry"}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{entry.content?.slice(0, 90) || "No content yet"}</p>
                    </div>
                    {entry.is_active_context ? <Brain size={14} className="text-primary flex-shrink-0" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={`text-[10px] uppercase tracking-widest border ${categoryClass}`}>{categoryKey}</Badge>
                    {entry.priority != null ? <Badge variant="outline" className="text-[10px]">Priority {entry.priority}</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry Editor</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, is_active_context: !current.is_active_context }))} className="gap-2">
              {form.is_active_context ? <Eye size={14} /> : <EyeOff size={14} />}
              {form.is_active_context ? "Active in AI" : "Inactive"}
            </Button>
          </div>

          <Card className="border-border bg-background/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Title</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Knowledge title" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</label>
                  <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Priority</label>
                  <Input type="number" min="0" max="10" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} placeholder="0-10" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tags</label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag one, tag two" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Content</label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} className="min-h-[220px]" placeholder="Capture the founder context, procedures, or working knowledge for the AI assistant." />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button type="button" className="gap-2" onClick={() => void handleSave()}>
                  <Save size={14} /> Save
                </Button>
                <Button type="button" variant="destructive" className="gap-2" onClick={() => void handleDelete()}>
                  <Trash2 size={14} /> Delete
                </Button>
                <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Star size={12} className="text-primary" /> Higher priority appears first
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FounderKnowledgeVault;
