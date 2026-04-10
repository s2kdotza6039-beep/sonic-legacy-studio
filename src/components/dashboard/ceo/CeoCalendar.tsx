import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const CeoCalendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const allEvents: any[] = [];

    // Fetch todos with due dates
    const { data: todos } = await supabase
      .from("ceo_todos")
      .select("*")
      .not("due_date", "is", null)
      .eq("is_done", false);
    if (todos) allEvents.push(...todos.map(t => ({ ...t, event_type: "todo", event_date: t.due_date })));

    // Fetch reminders
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_done", false);
    if (reminders) allEvents.push(...reminders.map(r => ({ ...r, event_type: "reminder", event_date: r.due_at?.split("T")[0] })));

    // Fetch tours
    const { data: tours } = await supabase
      .from("touring_log")
      .select("*");
    if (tours) allEvents.push(...tours.map(t => ({ ...t, event_type: "tour", event_date: t.start_date })));

    // Fetch subscription expiries
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .not("expiry_date", "is", null);
    if (subs) allEvents.push(...subs.map(s => ({ ...s, event_type: "subscription", event_date: s.expiry_date })));

    setEvents(allEvents);
  };

  const selectedDateStr = date ? format(date, "yyyy-MM-dd") : "";
  const dayEvents = events.filter(e => e.event_date === selectedDateStr);

  const eventDates = events.map(e => new Date(e.event_date)).filter(d => !isNaN(d.getTime()));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardContent className="p-4 flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" />
            {date ? format(date, "MMMM d, yyyy") : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events on this date.</p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((e, i) => (
                <div key={i} className="p-2 border border-border text-sm">
                  <span className={`text-xs uppercase tracking-wider mr-2 px-1.5 py-0.5 ${
                    e.event_type === "todo" ? "bg-blue-500/20 text-blue-400" :
                    e.event_type === "reminder" ? "bg-yellow-500/20 text-yellow-400" :
                    e.event_type === "tour" ? "bg-green-500/20 text-green-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>{e.event_type}</span>
                  {e.title || e.message || e.event_name || e.service_name}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoCalendar;
