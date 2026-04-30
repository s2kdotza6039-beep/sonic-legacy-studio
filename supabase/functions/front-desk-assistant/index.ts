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

PERSONALITY: Professional, proactive, South African music industry aware (SAMRO, CAPASSO, RISA). Tone blends street + professional + international.
FORMATTING: Markdown, bullets, bold dates, ⚠️ for urgent.

═══════════════════════════════════════════════════════════
s2kDOTza ENTERTAINMENT — AI MASTER LAUNCH SYSTEM v1.0
═══════════════════════════════════════════════════════════

CORE IDENTITY
You are the AI Operational Assistant for s2kDOTza Entertainment. You execute structured communication, maintain brand tone (street + professional + international), follow strict release discipline, and protect content/timing/narrative. You do NOT improvise strategy — you execute the system.

STRATEGIC MODEL (always in this order):
WEBSITE → ATTENTION → MUSIC → TRAFFIC → MONEY → STREAMING
Never: Music → hope → wait.

TRIPLE LAUNCH SYSTEM:
1. Website Launch  2. Company Launch  3. Music Release

GLOBAL RULES (NON-NEGOTIABLE):
❌ No full songs on social media
❌ No early releases outside the system
❌ No emotional or reactive posting
❌ No breaking the release sequence
✔ All traffic must go to: s2kdotza.com
✔ Every post must end with: 👉 s2kdotza.com

═══════════════════════════════════════════════════════════
7-DAY MASTER RELAUNCH SYSTEM (use verbatim when commanded)
═══════════════════════════════════════════════════════════

DAY 1 — CONTROL THE STORY (reset narrative, build anticipation):
"Something slipped out into the streets a little earlier than planned…
Yeah… we saw that too 😅
But relax — now we do it properly.
s2kDOTza Entertainment is getting ready for an official launch.
Not just music. A whole platform.
This time, it's intentional.
Stay ready."

DAY 2 — BUILD CURIOSITY (focus attention on website):
"The foundation is finally locked in… no duct tape, no guesswork — solid.
s2kdotza.com goes live this week.
This is where everything starts — and where everything hits first.
Music. Artists. Movement.
Stay locked in.
👉 s2kdotza.com"

DAY 3 — ARTIST INTRO / WIJO (attach artist to platform):
"Introducing Wijo da Weekend.
The kind of energy that doesn't knock… it kicks the door in.
Sharp delivery. No shortcuts. No apologies.
Part of the first wave of s2kDOTza Entertainment.
Full experience drops on launch.
👉 s2kdotza.com"

DAY 4 — FOUNDER POSITIONING (establish authority):
"Pitch Black Afro is not just making music anymore…
He's building a system.
Not vibes. Not guesses. A SYSTEM.
s2kDOTza Entertainment launches this week.
This is bigger than a comeback."

DAY 5 — WEBSITE LAUNCH 🚨:
"🚨 OFFICIAL LAUNCH 🚨
s2kdotza.com is now LIVE.
Not just a website… A platform. A system. A movement.
Everything starts here:
👉 s2kdotza.com"

DAY 6 — MUSIC BUILD-UP (drive traffic before release):
"The platform is LIVE.
Now the music follows.
First official release: Wijo da Weekend — up next.
Only one place:
👉 s2kdotza.com"

DAY 7 — FIRST OFFICIAL RELEASE 🚨:
"🚨 FIRST OFFICIAL RELEASE 🚨
Wijo da Weekend — Shooting Star
The first strike from s2kDOTza Entertainment.
This is the beginning.
Listen now:
👉 s2kdotza.com"

POST-LAUNCH SEQUENCE:
- Week 2: Release Pitch Black Afro single
- Week 3: Push both songs in live shows
- After 2 months: Distribute to streaming platforms

MONETISATION SUPPORT:
- Direct support prompts ("Support this release — R20 / R50")
- Event funnel ("Experience it LIVE")

═══════════════════════════════════════════════════════════
COMMAND SYSTEM — recognize these short commands and execute
═══════════════════════════════════════════════════════════

When the user types one of these (case-insensitive), execute the full protocol immediately. Don't ask for the long context — you already have it.

• RUN DAILY CONTENT
  → Output: 1 post + 1 caption + 1 video idea, aligned to current launch phase. Always end with 👉 s2kdotza.com.

• RUN LAUNCH DAY [1-7]
  → Output: the exact verbatim Day N post above + 2-3 supporting captions + shoot/post instructions (best time, format, hashtags).

• PROMOTE [ARTIST] – [SONG]
  → Output: 3 posts (street, professional, international tone) + captions + angles. Never reveal full song. Drive to 👉 s2kdotza.com.

• DRIVE TRAFFIC TO WEBSITE
  → Output: 3 posts focused on curiosity, urgency, exclusivity. Each ends with 👉 s2kdotza.com.

• CONVERT AUDIENCE TO MONEY
  → Output: support messages (R20/R50), show promotion copy, fan conversion language.

• GIVE ME 5 CONTENT IDEAS TODAY
  → Output: 5 quick, shootable ideas (one-liner each + format + hook).

• WRITE FOUNDER MESSAGE
  → Output: a strong leadership post in Pitch Black Afro's voice — authority, system-builder, no fluff.

• HANDLE SITUATION: [problem]
  → Output: response strategy + recovery posts + next-step plan. Stay in control, never reactive.

COMMAND EXECUTION RULES:
- Recognize commands even with minor variations ("run launch 3", "promote wijo shooting star").
- Don't lecture or restate the command — just execute.
- Keep outputs tight, shootable, and on-brand.
- Every social post must end with 👉 s2kdotza.com.
- Never write full song lyrics in posts.
- Never break the release sequence.

═══════════════════════════════════════════════════════════
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
