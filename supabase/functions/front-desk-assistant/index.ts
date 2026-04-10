import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversation_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch context from database for the assistant
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather business context
    let contextParts: string[] = [];

    // Get upcoming reminders
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_done", false)
      .order("due_at", { ascending: true })
      .limit(10);
    if (reminders?.length) {
      contextParts.push(`PENDING REMINDERS:\n${reminders.map(r => `- ${r.message} (due: ${r.due_at}, type: ${r.reminder_type})`).join("\n")}`);
    }

    // Get subscriptions expiring soon
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .order("expiry_date", { ascending: true });
    if (subs?.length) {
      const now = new Date();
      const expiringSoon = subs.filter(s => {
        if (!s.expiry_date) return false;
        const exp = new Date(s.expiry_date);
        const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil <= (s.reminder_days || 7);
      });
      contextParts.push(`ALL SUBSCRIPTIONS:\n${subs.map(s => `- ${s.service_name}: R${s.cost}/${s.billing_cycle}, expires: ${s.expiry_date || 'N/A'}, auto-renew: ${s.auto_renew}`).join("\n")}`);
      if (expiringSoon.length) {
        contextParts.push(`⚠️ EXPIRING SOON:\n${expiringSoon.map(s => `- ${s.service_name} expires ${s.expiry_date}`).join("\n")}`);
      }
    }

    // Get pending todos
    const { data: todos } = await supabase
      .from("ceo_todos")
      .select("*")
      .eq("is_done", false)
      .order("due_date", { ascending: true })
      .limit(15);
    if (todos?.length) {
      contextParts.push(`PENDING TO-DOs:\n${todos.map(t => `- [${t.priority}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`).join("\n")}`);
    }

    // Get recent deals
    const { data: deals } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (deals?.length) {
      contextParts.push(`ACTIVE DEALS:\n${deals.map(d => `- ${d.deal_title} (${d.client_name}): ${d.stage}, R${d.amount || 0}`).join("\n")}`);
    }

    // Get artist pipeline
    const { data: artists } = await supabase
      .from("artists")
      .select("name, status, genre, email")
      .limit(20);
    if (artists?.length) {
      contextParts.push(`ARTIST ROSTER:\n${artists.map(a => `- ${a.name} (${a.status}${a.genre ? `, ${a.genre}` : ''})`).join("\n")}`);
    }

    // Get upcoming tours
    const { data: tours } = await supabase
      .from("touring_log")
      .select("*")
      .order("start_date", { ascending: true })
      .limit(10);
    if (tours?.length) {
      contextParts.push(`TOURING SCHEDULE:\n${tours.map(t => `- ${t.event_name} at ${t.venue || 'TBD'}, ${t.city} (${t.start_date || 'TBD'}): ${t.status}`).join("\n")}`);
    }

    // Get contracts summary
    const { data: contracts } = await supabase
      .from("contracts")
      .select("title, status, contract_type, party_name, end_date, value")
      .limit(15);
    if (contracts?.length) {
      contextParts.push(`CONTRACTS:\n${contracts.map(c => `- ${c.title} (${c.contract_type}, ${c.status}): ${c.party_name || 'N/A'}, R${c.value || 0}${c.end_date ? `, ends: ${c.end_date}` : ''}`).join("\n")}`);
    }

    const businessContext = contextParts.length > 0
      ? `\n\nCURRENT BUSINESS CONTEXT (live data from the database):\n${contextParts.join("\n\n")}`
      : "";

    const systemPrompt = `You are the "Front Desk Assistant" for S2K DOT ZA, a South African music entertainment and record label company. You serve as an AI-powered personal business assistant to the CEO/Founder.

YOUR CAPABILITIES:
1. **Business Strategy** — Provide strategies for maximum productivity, growth planning, market positioning
2. **Business Mentorship** — Offer guidance on running a music label, artist management best practices
3. **Event Strategy** — Plan release strategies, concert logistics, festival applications, showcases
4. **Professional Planning** — Help plan releases (singles, EPs, albums), music videos, content calendars
5. **Contract Drafting** — Help draft and review contract clauses, suggest terms for artist/distribution/licensing agreements
6. **Email Drafting** — Draft professional emails for business communications (always present for confirmation before sending)
7. **Subscription Management** — Track and alert about subscription renewals, recommend cost optimizations
8. **Daily Operations** — Help with day-to-day tasks, scheduling, prioritization, follow-ups
9. **Reminders** — Suggest reminders for important deadlines, follow-ups, and payments

YOUR PERSONALITY:
- Professional yet approachable, like a trusted executive assistant
- Proactive — flag issues before they become problems
- South African business context aware (SAMRO, CAPASSO, RISA, etc.)
- Music industry knowledgeable
- Always present email drafts for confirmation, never send directly

FORMATTING:
- Use markdown for structured responses
- Use bullet points for action items
- Bold important dates and deadlines
- Flag urgent items with ⚠️
${businessContext}

When the user asks about subscriptions, contracts, or deadlines, reference the live data above. If you detect subscriptions expiring soon, proactively mention them.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("front-desk-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
