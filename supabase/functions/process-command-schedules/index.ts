import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function computeNextRun(frequency: string, hour: number, dow: number | null): Date {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (frequency === "hourly") {
    next.setHours(now.getHours() + 1);
    return next;
  }
  next.setHours(hour);
  if (frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (frequency === "weekly") {
    const target = dow ?? 1;
    const diff = (target - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= now ? 7 : diff));
    return next;
  }
  next.setDate(next.getDate() + 1);
  return next;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    const { data: due } = await supabase
      .from("command_schedules")
      .select("*")
      .eq("is_active", true)
      .or(`next_run_at.is.null,next_run_at.lte.${now}`);

    const results: any[] = [];
    for (const s of due ?? []) {
      const { data: run } = await supabase
        .from("command_runs")
        .insert({ command: s.command, triggered_by: "schedule", schedule_id: s.id, status: "running" })
        .select().single();

      try {
        const startedAt = new Date();
        const { error } = await supabase.functions.invoke("front-desk-assistant", {
          body: { messages: [{ role: "user", content: s.command }] },
        });
        if (error) throw error;

        // Wait briefly then collect drafts created since started_at with matching command
        await new Promise((r) => setTimeout(r, 1500));
        const { data: drafts } = await supabase
          .from("ai_drafts")
          .select("id")
          .eq("command", s.command)
          .gte("created_at", startedAt.toISOString());

        const ids = (drafts ?? []).map((d: any) => d.id);
        await supabase.from("command_runs").update({
          status: "completed", completed_at: new Date().toISOString(),
          draft_ids: ids, draft_count: ids.length,
        }).eq("id", run!.id);

        const next_run_at = computeNextRun(s.frequency, s.hour_of_day, s.day_of_week).toISOString();
        await supabase.from("command_schedules").update({
          last_run_at: new Date().toISOString(), next_run_at,
        }).eq("id", s.id);

        results.push({ schedule_id: s.id, ok: true, drafts: ids.length });
      } catch (e: any) {
        await supabase.from("command_runs").update({
          status: "failed", completed_at: new Date().toISOString(), error_message: String(e?.message ?? e),
        }).eq("id", run!.id);
        results.push({ schedule_id: s.id, ok: false, error: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
