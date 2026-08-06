import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const contextParts: string[] = [];

    const { data: artists } = await supabase
      .from("artists")
      .select("name, genre, status")
      .in("status", ["signed", "New Artist"])
      .limit(30);
    if (artists?.length) {
      contextParts.push(
        `ARTISTS (public roster):\n${artists.map((a) => `- ${a.name}${a.genre ? ` (${a.genre})` : ""}`).join("\n")}`,
      );
    }

    const { data: releases } = await supabase
      .from("releases")
      .select("title, artist_name, release_type, status")
      .eq("status", "published")
      .limit(30);
    if (releases?.length) {
      contextParts.push(
        `RELEASES (published):\n${releases.map((r) => `- "${r.title}" by ${r.artist_name ?? "s2kDOTza"}${r.release_type ? ` [${r.release_type}]` : ""}`).join("\n")}`,
      );
    }

    const { data: events } = await supabase
      .from("events")
      .select("title, artist_name, venue, city, start_date, ticket_url")
      .eq("status", "published")
      .gte("start_date", nowIso)
      .order("start_date", { ascending: true })
      .limit(20);
    if (events?.length) {
      contextParts.push(
        `UPCOMING EVENTS:\n${events.map((e) => `- ${e.title}${e.artist_name ? ` — ${e.artist_name}` : ""} @ ${e.venue ?? "TBA"}${e.city ? `, ${e.city}` : ""} on ${e.start_date}${e.ticket_url ? ` (tickets: ${e.ticket_url})` : ""}`).join("\n")}`,
      );
    }

    const { data: news } = await supabase
      .from("news_posts")
      .select("title, excerpt, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(10);
    if (news?.length) {
      contextParts.push(
        `NEWS:\n${news.map((n) => `- ${n.title}${n.excerpt ? `: ${n.excerpt}` : ""}${n.published_at ? ` (${n.published_at})` : ""}`).join("\n")}`,
      );
    }

    const systemPrompt = `You are PALESA, the warm and friendly Front Desk assistant for s2kDOTza Entertainment (s2kdotza.com), a South African music and cultural development company.

YOUR JOB
- Welcome visitors, answer general questions about the company, its artists, music, shows and news.
- Guide people to the right page with clear action words:
  /artists (roster), /listen (music), /watch (videos), /events (shows), /news (updates), /services, /partnerships, /contact (all enquiries).

HARD LIMITS (never break these)
- You are a PUBLIC assistant. You have NO access to the private office, dashboard, knowledge vault, contracts, finances, royalties, contacts or any internal data.
- If asked about private/internal matters, deals, money, or staff details: decline gracefully and point them to /contact.
- Never invent facts. If something is not in the PUBLIC CONTEXT below, say you don't have that detail and direct them to /contact.
- Do not collect sensitive personal information. Business and talent enquiries go through the forms on /contact and /careers (reviewed within 30 days).

PERSONALITY
- Warm, friendly, professional, proudly South African. Occasional friendly emoji 😊 (not every line).
- Short, scannable replies. Use bullets. Keep it under ~120 words unless asked for more.

PUBLIC CONTEXT
${contextParts.length ? contextParts.join("\n\n") : "No public listings available right now."}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...(Array.isArray(messages) ? messages.slice(-20) : []),
        ],
      }),
    });

    if (!resp.ok) {
      const status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      const text = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error:
            status === 429
              ? "PALESA is busy right now. Please try again shortly."
              : status === 402
                ? "Assistant is temporarily unavailable."
                : text || "Assistant error",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
