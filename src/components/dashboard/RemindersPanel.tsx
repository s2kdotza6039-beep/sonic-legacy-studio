import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check } from "lucide-react";

interface Reminder {
  id: string;
  related_type: string;
  reminder_type: string;
  message: string;
  due_at: string;
  is_done: boolean;
}

const RemindersPanel = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const fetchReminders = async () => {
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_done", false)
      .order("due_at", { ascending: true })
      .limit(10);
    if (data) setReminders(data);
  };

  useEffect(() => {
    fetchReminders();
    const channel = supabase
      .channel("reminders-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, fetchReminders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markDone = async (id: string) => {
    await supabase.from("reminders").update({ is_done: true }).eq("id", id);
  };

  const isOverdue = (due: string) => new Date(due) < new Date();

  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-primary" />
        <h3 className="font-display font-bold text-lg">Reminders</h3>
        {reminders.length > 0 && (
          <span className="bg-destructive/20 text-destructive text-xs px-2 py-0.5 rounded-sm ml-auto">{reminders.length}</span>
        )}
      </div>
      {reminders.length === 0 && <p className="text-sm text-muted-foreground">No pending reminders.</p>}
      <div className="space-y-2">
        {reminders.map((r) => (
          <div key={r.id} className={`flex items-center justify-between gap-3 p-3 border ${isOverdue(r.due_at) ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.message}</p>
              <p className="text-xs text-muted-foreground">{r.related_type} · {r.reminder_type}</p>
            </div>
            <button onClick={() => markDone(r.id)} className="text-muted-foreground hover:text-green-400 transition-colors">
              <Check size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RemindersPanel;
