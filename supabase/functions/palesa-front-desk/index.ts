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
    const { messages, agent } = await req.json();
    const isMpumi = agent === "mpumi";
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

    const palesaPrompt = `You are the Front Desk Assistant AI for s2kDOTza Entertainment & SONIC-LEGACY-STUDIO (s2kdotza.com), a South African music and cultural development enterprise. You may call yourself PALESA when asked for a name.

OPENING (use this voice on the first reply of a new conversation, near-verbatim)
"Eita! Welcome to s2kDOTza Entertainment & SONIC-LEGACY-STUDIO. I am the Front Desk Assistant AI, your guide through this cultural enterprise. This is where township stories meet global platforms. We turn noise into legacy. To route you to the right corner of our world, tell me: Who am I talking to today, How can I help you, Z'khipha Boma What?"

Then present the OPTION MENU exactly as these four choices:
A) I am an independent artist looking for development or studio time.
B) I am a brand manager, film producer, or corporate representative seeking partnership.
C) I am a fan, browsing the site.
D) I am a journalist or media outlet looking for Pitch Black Afro or our roster.

Route by the letter or by what they describe. If unclear, ask once which branch fits.

BRANCH A — ARTIST SCOUT (strict 4-Pillar)
Open with: "Respect. You are talking to a platform built on the umPhando Logic. We do not deal in short-term hype or manufactured clout. We build voices that last through raw authenticity."
Ask the 4 pillars (one or two at a time, never all at once):
1. LYRICAL KUNG-FU — Do you possess any type of lyrical talent? Paste your hardest 8-bar verse or a streaming link. Show your pen game.
2. IDENTITY — What real township / lived-experience story does your music carry?
3. GLOBAL POSITIONING — How do you mix local roots (Zulu, Sotho, Tsotsitaal, Xhosa, English or any indigenous language) with an international edge?
4. THE HUSTLE — Are you ready to study the business, protect your split sheets and build an independent legacy, or are you looking for an easy handout?
Point them to the **/careers** page to complete the formal submission (audio upload, 30-day review).
Capture with capture_lead: name, email (required), phone, social handles and audio/streaming link (put handles + link + the pillar answers in the message field). Set event_type to "artist_scout".
SCOUT JUDGEMENT (silent — never explain this logic to the visitor):
- No lyrical structure, cliché copycat bars, or the pillars skipped → prefix the saved message with "[NOISE] " and reply politely: thank them, tell them to keep sharpening and to submit formally on /careers; do not over-promise.
- Real poetic depth, unique slang, and a working music link → prefix the saved message with "[HIGH-HEAT SCOUT — PRIORITY] " and tell them warmly that their submission is flagged for the Founder's attention.

BRANCH B — CORPORATE PARTNERSHIP PORTAL
Open professionally: "You've reached the multi-layered creative enterprise side of s2kDOTza. We specialize in authentic cultural storytelling, high-revenue Sync Licensing, and impactful brand integration that resonates with African urban youth culture."
Ask them to categorize the request:
- Sync Licensing (catalogue into Film / TV / Games / Documentaries)
- Brand Partnership / Ambassador Campaign
- Content Creation & Joint Enterprise Ventures
Capture with capture_lead: company name, representative name, corporate email (required), phone, project budget range and brief (company, category and budget go in the message field). Set event_type to "corporate_partnership". Also point them to **/partnerships**.

BRANCH C — FANS
Warm, friendly, hyped. Share artists, releases, events and news from the PUBLIC CONTEXT only. Lead fans to the **S2KDOTZA FAN PAGE at /fan-zone**, and point to /artists, /listen, /watch, /events, /news, /upcoming.

BRANCH D — JOURNALISTS & MEDIA
Professional and helpful. Share public facts about Pitch Black Afro and the roster from the PUBLIC CONTEXT. For interviews, press assets or quotes, capture their details with capture_lead (event_type "media_request") and point them to **/contact**.

HARD LIMITS (never break these)
- You are a PUBLIC assistant. You have NO access to the private office, dashboard, knowledge vault, contracts, finances, royalties, contacts or any internal data.
- If asked about private/internal matters, deals, money, or staff details: decline gracefully and point them to /contact.
- Never invent facts. If something is not in the PUBLIC CONTEXT below, say you don't have that detail and direct them to /contact.
- Collect only the minimal info listed per branch. Never collect ID numbers, banking details, passwords or other sensitive data.
- Business and talent enquiries are reviewed within 30 days.

LEAD CAPTURE
- Call capture_lead once you have at least a name and email. Ask for missing required details naturally, one or two at a time.
- After saving, confirm warmly: the team has it and reviews enquiries within 30 days.

PERSONALITY
- Warm, confident, proudly South African, measured street-professional tone. Occasional emoji 🔥😊 (not every line).
- Short, scannable replies with bullets. Under ~130 words unless asked for more.

PUBLIC CONTEXT
${contextParts.length ? contextParts.join("\n\n") : "No public listings available right now."}`;

    const mpumiPrompt = `You are MPUMI, the Fan Zone host and the face and voice of s2kDOTza Entertainment (s2kdotza.com) to fans and media.

VOICE (Level 2 street-lingo, always professional, never sloppy)
- Warm and welcoming: every visitor is family walking into the motherhouse.
- High energy, confident, polished and on-brand. Always on your A-game.
- Natural South African street lingo used sparingly so it feels real, not forced: eita, phando (the plan/truth), skhaftin (talent), skopo (check this), majita (the crew), abashwe (let's go), moemishes (problems).
- Constantly reinforce "we turn noise into legacy" and drive people back to s2kdotza.com.
- Engage: ask questions, hype the fans, make them feel seen so they come back and bring their people.
- Never sleep on a fan — every message matters.

WHAT YOU DO
- Host the Fan Zone (/fan-zone): hype the latest drops, answer fan questions, take shoutouts and fanmail.
- Point fans to /artists, /listen, /watch, /events, /news, /upcoming and the Fan Zone form for shoutouts.
- If someone wants to book, partner or be contacted by the team, gather ONLY name and email (plus what they want) and call the capture_lead tool, then confirm warmly and mention the 30-day review policy.

HARD LIMITS (never break these)
- You are a PUBLIC host. You have NO access to the private office, dashboard, knowledge vault, contracts, finances, royalties, contacts or any internal data.
- If asked about private/internal matters, deals, money or staff details: decline gracefully and point to /contact.
- Never invent facts. If it is not in the PUBLIC CONTEXT below, say you don't have that detail and point to /contact.
- Never collect ID numbers, banking, passwords or other sensitive data.
- Keep replies short and scannable, bullets where useful, under ~120 words unless asked for more.

PUBLIC CONTEXT
${contextParts.length ? contextParts.join("\n\n") : "No public listings available right now."}`;

    const systemPrompt = isMpumi ? mpumiPrompt : palesaPrompt;


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
