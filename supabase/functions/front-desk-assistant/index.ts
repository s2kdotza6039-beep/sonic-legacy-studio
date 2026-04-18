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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather business context
    const contextParts: string[] = [];

    const { data: reminders } = await supabase
      .from("reminders").select("*").eq("is_done", false)
      .order("due_at", { ascending: true }).limit(10);
    if (reminders?.length) {
      contextParts.push(`PENDING REMINDERS:\n${reminders.map(r => `- ${r.message} (due: ${r.due_at}, type: ${r.reminder_type})`).join("\n")}`);
    }

    const { data: subs } = await supabase
      .from("subscriptions").select("*").eq("status", "active")
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

    const { data: todos } = await supabase
      .from("ceo_todos").select("*").eq("is_done", false)
      .order("due_date", { ascending: true }).limit(15);
    if (todos?.length) {
      contextParts.push(`PENDING TO-DOs:\n${todos.map(t => `- [${t.priority}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`).join("\n")}`);
    }

    const { data: deals } = await supabase
      .from("deals").select("*").order("created_at", { ascending: false }).limit(10);
    if (deals?.length) {
      contextParts.push(`ACTIVE DEALS:\n${deals.map(d => `- ${d.deal_title} (${d.client_name}): ${d.stage}, R${d.amount || 0}`).join("\n")}`);
    }

    const { data: artists } = await supabase
      .from("artists").select("name, status, genre, email").limit(20);
    if (artists?.length) {
      contextParts.push(`ARTIST ROSTER:\n${artists.map(a => `- ${a.name} (${a.status}${a.genre ? `, ${a.genre}` : ''})${a.email ? ` <${a.email}>` : ''}`).join("\n")}`);
    }

    const { data: contacts } = await supabase
      .from("ceo_contacts").select("name, email, role, company, category").limit(30);
    if (contacts?.length) {
      contextParts.push(`CEO CONTACTS:\n${contacts.map(c => `- ${c.name}${c.role ? `, ${c.role}` : ''}${c.company ? ` @ ${c.company}` : ''}${c.email ? ` <${c.email}>` : ''}`).join("\n")}`);
    }

    const { data: tours } = await supabase
      .from("touring_log").select("*").order("start_date", { ascending: true }).limit(10);
    if (tours?.length) {
      contextParts.push(`TOURING SCHEDULE:\n${tours.map(t => `- ${t.event_name} at ${t.venue || 'TBD'}, ${t.city} (${t.start_date || 'TBD'}): ${t.status}`).join("\n")}`);
    }

    const { data: contracts } = await supabase
      .from("contracts").select("title, status, contract_type, party_name, end_date, value").limit(15);
    if (contracts?.length) {
      contextParts.push(`CONTRACTS:\n${contracts.map(c => `- ${c.title} (${c.contract_type}, ${c.status}): ${c.party_name || 'N/A'}, R${c.value || 0}${c.end_date ? `, ends: ${c.end_date}` : ''}`).join("\n")}`);
    }

    const businessContext = contextParts.length > 0
      ? `\n\nCURRENT BUSINESS CONTEXT (live data from the database):\n${contextParts.join("\n\n")}`
      : "";

    const systemPrompt = `You are the "Front Desk Assistant" for S2K DOT ZA, a South African music entertainment and record label company. You serve as an AI-powered personal business assistant to the CEO/Founder.

YOUR CAPABILITIES:
1. Business Strategy, Mentorship, Event Planning, Release Planning
2. Contract Drafting and Review
3. Email Drafting — use the draft_email tool to queue emails into the founder's Outbox for review and one-click confirmation. NEVER claim to have sent an email; you only DRAFT.
4. Subscription Management, Daily Operations, Reminders

EMAIL DRAFTING RULES:
- When the user asks you to email someone, ALWAYS call the draft_email tool with recipient_email, subject, and body.
- If the user mentions a contact by name only and you can match them in CEO CONTACTS or ARTIST ROSTER above, use that email automatically.
- If recipient_email is unknown, ask for it before calling the tool.
- After calling the tool, briefly confirm the draft is in the Outbox and summarize what you wrote in 1-2 lines. Do NOT repeat the full email body in chat.
- Body should be plain text with paragraph breaks (use double newlines). No HTML, no markdown.
- Subject should be concise and specific — never generic like "Following up".
- Sign off with the founder's name when known, otherwise "s2kDOTza Entertainment".

PERSONALITY: Professional, proactive, South African music industry aware (SAMRO, CAPASSO, RISA).
FORMATTING: Markdown, bullets, bold dates, ⚠️ for urgent.
${businessContext}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "draft_email",
          description: "Create a draft email in the founder's Outbox for review before sending. Use this whenever the user asks you to write, draft, or send an email.",
          parameters: {
            type: "object",
            properties: {
              recipient_email: { type: "string", description: "The recipient's email address" },
              recipient_name: { type: "string", description: "Optional recipient display name" },
              subject: { type: "string", description: "Concise, specific email subject" },
              body: { type: "string", description: "Full plain-text email body. Use double newlines for paragraph breaks. Do not include the subject in the body." },
            },
            required: ["recipient_email", "subject", "body"],
          },
        },
      },
    ];

    const callAI = async (msgs: any[], stream: boolean) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, ...msgs],
          tools,
          stream,
        }),
      });

    // First call: non-streaming so we can detect tool calls reliably.
    const first = await callAI(messages, false);
    if (!first.ok) {
      if (first.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (first.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await first.text();
      console.error("AI gateway error:", first.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firstJson = await first.json();
    const choice = firstJson.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    let followupMessages = messages;
    if (toolCalls && toolCalls.length > 0) {
      const assistantMsg = { role: "assistant", content: choice.message.content || "", tool_calls: toolCalls };
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        if (tc.function?.name === "draft_email") {
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            const { error: dErr, data: draft } = await supabase.from("email_drafts").insert({
              recipient_email: args.recipient_email,
              recipient_name: args.recipient_name || null,
              subject: args.subject,
              body: args.body,
              status: "draft",
              source: "ai_assistant",
              conversation_id: conversation_id || null,
            }).select().single();
            if (dErr) throw dErr;
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true, draft_id: draft.id, message: "Draft saved to Outbox. Tell the user to review it in CEO Diary → Outbox." }) });
          } catch (e) {
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }) });
          }
        }
      }
      followupMessages = [...messages, assistantMsg, ...toolResults];
    }

    // Second call: streaming for the user-visible reply.
    const second = await callAI(followupMessages, true);
    if (!second.ok) {
      const t = await second.text();
      console.error("AI followup error:", second.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(second.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("front-desk-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
