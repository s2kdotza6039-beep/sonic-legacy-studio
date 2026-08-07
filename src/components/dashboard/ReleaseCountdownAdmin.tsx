import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Timer, Play, Square, Save } from "lucide-react";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

const ReleaseCountdownAdmin = () => {
  const { isFounder } = useUserRole();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("upcoming_release")
      .select("title, subtitle, release_date, countdown_active")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setTitle(data.title ?? "");
      setSubtitle(data.subtitle ?? "");
      setReleaseDate(toLocalInput(data.release_date));
      setActive(!!data.countdown_active);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!isFounder) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("upcoming_release")
      .update({
        title: title.trim() || "Next Release",
        subtitle: subtitle.trim() || null,
        release_date: new Date(releaseDate).toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Upcoming release updated." });
  };

  const toggle = async (next: boolean) => {
    const { error } = await supabase
      .from("upcoming_release")
      .update({ countdown_active: next })
      .eq("id", 1);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setActive(next);
    toast({ title: next ? "Countdown started" : "Countdown stopped" });
  };

  return (
    <div className="border border-border bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Release Countdown</h3>
        </div>
        <Badge variant={active ? "default" : "secondary"}>{active ? "ON" : "OFF"}</Badge>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Release date &amp; time</Label>
              <Input
                type="datetime-local"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              <Save size={14} className="mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
            {active ? (
              <Button size="sm" variant="outline" onClick={() => toggle(false)}>
                <Square size={14} className="mr-1" /> Stop countdown
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => toggle(true)}>
                <Play size={14} className="mr-1" /> Start countdown
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleaseCountdownAdmin;
