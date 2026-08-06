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

LEAD CAPTURE
- If a visitor clearly wants to book an artist, perform, appear, collaborate, or be contacted by the team, gather ONLY the minimal info needed: name and email (required), phone (optional), what they want, and event details (type, date, venue, artist) if it's a booking.
- Ask for missing required details naturally, one or two at a time. Once you have at least a name and email, call the capture_lead tool.
- Never collect ID numbers, banking, passwords or other sensitive data.
- After saving, confirm warmly: tell them the team has it and reviews enquiries within 30 days, and point them to /contact for anything more detailed.

PERSONALITY
- Warm, friendly, professional, proudly South African. Occasional friendly emoji 😊 (not every line).
- Short, scannable replies. Use bullets. Keep it under ~120 words unless asked for more.

PUBLIC CONTEXT
${contextParts.length ? contextParts.join("\n\n") : "No public listings available right now."}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "capture_lead",
          description:
            "Save a visitor's booking or contact enquiry as a lead for the s2kDOTza team. Requires at least a name and email.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Visitor's full name" },
              email: { type: "string", description: "Visitor's email address" },
              phone: { type: "string", description: "Optional phone number" },
              event_type: { type: "string", description: "Type of request or event" },
              event_date: { type: "string", description: "Event date, YYYY-MM-DD if known" },
              venue: { type: "string", description: "Venue or location" },
              artist_requested: { type: "string", description: "Artist they want to book" },
              message: { type: "string", description: "Summary of what they are asking for" },
            },
            required: ["name", "email"],
            additionalProperties: false,
          },
        },
      },
    ];

    const baseMessages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(messages) ? messages.slice(-20) : []),
    ];

    const callGateway = (body: Record<string, unknown>) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", ...body }),
      });

    const errorResponse = async (r: Response) => {
      const status = r.status === 429 ? 429 : r.status === 402 ? 402 : 500;
      const text = await r.text().catch(() => "");
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
    };

    // First pass (non-streaming) to detect lead capture
    const toolPass = await callGateway({ messages: baseMessages, tools, stream: false });
    if (!toolPass.ok) return await errorResponse(toolPass);

    const toolJson = await toolPass.json().catch(() => null);
    const choiceMsg = toolJson?.choices?.[0]?.message;
    const toolCalls = choiceMsg?.tool_calls ?? [];

    const followUp: unknown[] = [];
    if (toolCalls.length) {
      followUp.push(choiceMsg);
      for (const tc of toolCalls) {
        let result = "Sorry, I could not save that.";
        if (tc?.function?.name === "capture_lead") {
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            const { error } = await supabase.from("booking_enquiries").insert({
              name: String(args.name ?? "").slice(0, 200),
              email: String(args.email ?? "").slice(0, 255),
              phone: args.phone ? String(args.phone).slice(0, 50) : null,
              event_type: args.event_type ? String(args.event_type).slice(0, 200) : null,
              event_date: args.event_date || null,
              venue: args.venue ? String(args.venue).slice(0, 200) : null,
              artist_requested: args.artist_requested ? String(args.artist_requested).slice(0, 200) : null,
              message: args.message ? String(args.message).slice(0, 2000) : null,
              status: "new",
            });
            result = error
              ? `Could not save the enquiry: ${error.message}`
              : "Lead saved successfully. Confirm warmly to the visitor and mention the 30-day review policy.";
          } catch (_e) {
            result = "Could not read the enquiry details.";
          }
        }
        followUp.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    const resp = await callGateway({
      stream: true,
      messages: [...baseMessages, ...followUp],
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
