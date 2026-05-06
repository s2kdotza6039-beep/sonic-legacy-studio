import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { format } from "date-fns";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  start_date: string;
  end_date: string | null;
  image_url: string | null;
  ticket_url: string | null;
  artist_name: string | null;
};

const Events = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });
      setEvents((data as EventRow[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Live Experience</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Events</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Upcoming s2kDOTza Entertainment shows, showcases, and live experiences.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-4xl mx-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading events…</p>
        ) : events.length === 0 ? (
          <div className="border border-border p-12 text-center">
            <Calendar size={32} className="text-primary mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-display font-bold mb-2">No upcoming events</h2>
            <p className="text-sm text-muted-foreground">
              New shows are announced as they're confirmed. Stay locked in.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {events.map((e) => (
              <article key={e.id} className="border-b border-border pb-8 grid md:grid-cols-3 gap-6">
                {e.image_url && (
                  <img
                    src={e.image_url}
                    alt={e.title}
                    loading="lazy"
                    className="w-full aspect-video object-cover md:col-span-1"
                  />
                )}
                <div className={e.image_url ? "md:col-span-2" : "md:col-span-3"}>
                  <div className="flex items-center gap-3 mb-2 flex-wrap text-xs uppercase tracking-widest">
                    <span className="text-primary flex items-center gap-1">
                      <Calendar size={12} />
                      {format(new Date(e.start_date), "EEE d MMM yyyy · HH:mm")}
                    </span>
                    {e.artist_name && <span className="text-muted-foreground">· {e.artist_name}</span>}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">{e.title}</h2>
                  {(e.venue || e.city) && (
                    <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                      <MapPin size={12} className="text-primary" />
                      {[e.venue, e.city, e.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {e.description && (
                    <p className="text-foreground/80 whitespace-pre-wrap mb-4">{e.description}</p>
                  )}
                  {e.ticket_url && (
                    <a
                      href={e.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary border border-primary px-4 py-2 hover:bg-primary hover:text-primary-foreground transition"
                    >
                      <Ticket size={12} /> Get Tickets
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Events;
