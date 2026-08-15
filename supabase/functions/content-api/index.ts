import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const errors: Record<string, string> = {};

    const [artistsRes, releasesRes, eventsRes, newsRes, contentRes] = await Promise.all([
      supabase.from("artists").select("*").in("status", ["signed", "New Artist"]).order("name", { ascending: true }).limit(50),
      supabase.from("releases").select("*").eq("status", "published").order("released_at", { ascending: false }).limit(50),
      supabase.from("events").select("*").eq("status", "published").gte("start_date", nowIso).order("start_date", { ascending: true }).limit(50),
      supabase.from("news_posts").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(50),
      supabase.from("content_posts").select("*").eq("post_status", "published").order("posted_at", { ascending: false }).limit(50),
    ]);

    const pick = (key: string, res: { data: unknown; error: { message: string } | null }) => {
      if (res.error) { errors[key] = res.error.message; return []; }
      return res.data ?? [];
    };

    return new Response(
      JSON.stringify({
        ok: true,
        generated_at: nowIso,
        site: "s2kdotza.com",
        artists: pick("artists", artistsRes as never),
        releases: pick("releases", releasesRes as never),
        events: pick("events", eventsRes as never),
        news: pick("news", newsRes as never),
        content_posts: pick("content_posts", contentRes as never),
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("content-api error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
