import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, Trash2 } from "lucide-react";

const CeoTodos = () => {
  const [todos, setTodos] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  const { toast } = useToast();

  const fetch = async () => {
    let q = supabase.from("ceo_todos").select("*").order("is_done").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (!showDone) q = q.eq("is_done", false);
    const { data } = await q;
    if (data) setTodos(data);
  };

  useEffect(() => { fetch(); }, [showDone]);

  const add = async () => {
    if (!title.trim()) return;
    await supabase.from("ceo_todos").insert({ title, priority, due_date: dueDate || null });
    setTitle(""); setDueDate("");
    toast({ title: "Task added" });
    fetch();
  };

  const toggle = async (id: string, done: boolean) => {
    await supabase.from("ceo_todos").update({ is_done: !done }).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    await supabase.from("ceo_todos").delete().eq("id", id);
    fetch();
  };

  const priorityColor = (p: string) =>
    p === "high" ? "text-red-400" : p === "medium" ? "text-yellow-400" : "text-green-400";

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <Input placeholder="New task..." value={title} onChange={e => setTitle(e.target.value)} className="flex-1 min-w-[200px] h-9 text-sm" onKeyDown={e => e.key === "Enter" && add()} />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-[140px] h-9 text-xs" />
        <Button size="sm" onClick={add} className="gap-1 text-xs"><Plus size={12} /> Add</Button>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowDone(!showDone)} className="text-xs text-muted-foreground hover:text-foreground">
          {showDone ? "Hide completed" : "Show completed"}
        </button>
      </div>

      <div className="space-y-1">
        {todos.map(t => (
          <div key={t.id} className={`flex items-center gap-3 p-2 border border-border group ${t.is_done ? "opacity-50" : ""}`}>
            <button onClick={() => toggle(t.id, t.is_done)} className={`w-5 h-5 border flex items-center justify-center ${t.is_done ? "bg-primary border-primary" : "border-border hover:border-primary"}`}>
              {t.is_done && <Check size={12} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${t.is_done ? "line-through" : ""}`}>{t.title}</p>
            </div>
            <span className={`text-xs uppercase ${priorityColor(t.priority)}`}>{t.priority}</span>
            {t.due_date && <span className="text-xs text-muted-foreground">{t.due_date}</span>}
            <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {todos.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tasks. Add one above!</p>}
      </div>
    </div>
  );
};

export default CeoTodos;
