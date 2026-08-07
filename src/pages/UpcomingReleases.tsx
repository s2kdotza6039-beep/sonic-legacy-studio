import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Disc3 } from "lucide-react";

type Row = {
  title: string;
  subtitle: string | null;
  release_date: string;
  countdown_active: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

const parts = (ms: number) => ({
  days: Math.max(0, Math.floor(ms / 86400000)),
  hours: Math.max(0, Math.floor((ms % 86400000) / 3600000)),
  minutes: Math.max(0, Math.floor((ms % 3600000) / 60000)),
  seconds: Math.max(0, Math.floor((ms % 60000) / 1000)),
});

const UpcomingReleases = () => {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("upcoming_release")
        .select("title, subtitle, release_date, countdown_active")
        .eq("id", 1)
        .maybeSingle();
      setRow((data as Row) ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = row ? new Date(row.release_date).getTime() : 0;
  const diff = target - now;
  const p = parts(diff);
  const live = !!row?.countdown_active;

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Upcoming</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            {loading ? "Upcoming Releases" : row?.title || "Upcoming Releases"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {row?.subtitle || "New music from the s2kDOTza Entertainment camp."}
          </p>
        </div>
      </div>

      <div className="section-padding max-w-4xl mx-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
        ) : !live ? (
          <div className="border border-border p-12 text-center">
            <Disc3 size={32} className="text-primary mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-display font-bold mb-2">Release date to be announced</h2>
            <p className="text-sm text-muted-foreground">
              The countdown starts the moment the date is locked. Stay close.
            </p>
          </div>
        ) : diff <= 0 ? (
          <div className="border border-primary/40 p-12 text-center">
            <h2 className="text-2xl font-display font-bold mb-2 text-primary">It's out.</h2>
            <p className="text-sm text-muted-foreground">The release is live.</p>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground text-center mb-6">
              Counting down to release
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Days", value: p.days },
                { label: "Hours", value: p.hours },
                { label: "Minutes", value: p.minutes },
                { label: "Seconds", value: p.seconds },
              ].map((b) => (
                <div key={b.label} className="border border-border bg-card p-6 text-center">
                  <div className="text-4xl md:text-5xl font-display font-bold text-primary tabular-nums">
                    {pad(b.value)}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {b.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">
              {new Date(row!.release_date).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UpcomingReleases;
