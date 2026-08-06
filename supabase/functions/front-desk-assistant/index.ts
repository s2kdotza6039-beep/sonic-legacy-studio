import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireFounderOrService } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth gate: only the founder (or server-to-server service role) may invoke this.
  const denied = await requireFounderOrService(req);
  if (denied) return denied;

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

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("title, artist_name, venue, city, country, start_date, ticket_url")
      .eq("status", "published")
      .gte("start_date", new Date().toISOString())
      .order("start_date", { ascending: true })
      .limit(15);
    if (upcomingEvents?.length) {
      contextParts.push(`UPCOMING EVENTS & SHOWS:\n${upcomingEvents.map(e => `- ${e.title}${e.artist_name ? ` — ${e.artist_name}` : ''} @ ${e.venue || 'TBD'}, ${e.city || ''}${e.country ? `, ${e.country}` : ''} on ${e.start_date}${e.ticket_url ? ` (tickets: ${e.ticket_url})` : ''}`).join("\n")}`);
    }

    const { data: unpaidRoyalties } = await supabase
      .from("royalty_income")
      .select("source, month, gross, net, fees, territory")
      .eq("paid", false)
      .order("month", { ascending: false })
      .limit(12);
    if (unpaidRoyalties?.length) {
      contextParts.push(`ROYALTIES (unpaid):\n${unpaidRoyalties.map(r => `- ${r.source} (${r.month}): gross R${r.gross || 0}, net R${r.net || 0}, fees R${r.fees || 0}${r.territory ? `, ${r.territory}` : ''}`).join("\n")}`);
    }

    const { data: bookingLeads } = await supabase
      .from("booking_enquiries")
      .select("name, artist_requested, event_type, event_date, budget, status, email")
      .in("status", ["new", "pending", "open"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (bookingLeads?.length) {
      contextParts.push(`BOOKING LEADS NEEDING ATTENTION:\n${bookingLeads.map(b => `- ${b.name}${b.artist_requested ? ` → ${b.artist_requested}` : ''}${b.event_type ? ` (${b.event_type})` : ''}${b.event_date ? ` on ${b.event_date}` : ''}${b.budget ? `, budget R${b.budget}` : ''} — ${b.status}${b.email ? ` <${b.email}>` : ''}`).join("\n")}`);
    }

    const { data: memoryRows } = await supabase
      .from("sydney_memory")
      .select("key, value, category")
      .eq("important", true)
      .order("updated_at", { ascending: false })
      .limit(30);
    const memoryContext = memoryRows?.length
      ? `\n\nSYDNEY MEMORY (facts the founder told me — remember these):\n${memoryRows.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join("\n")}`
      : "";

    const businessContext = contextParts.length > 0

      ? `\n\nCURRENT BUSINESS CONTEXT (live data from the database):\n${contextParts.join("\n\n")}`
      : "";

    // Founder Constitution / Knowledge Vault (Layer 2 — binding rules)
    const { data: vault } = await supabase
      .from("knowledge_vault")
      .select("category, title, body, is_constitutional, priority")
      .eq("active", true)
      .order("priority", { ascending: false });

    const vaultContext = vault?.length
      ? `\n\nFOUNDER CONSTITUTION & KNOWLEDGE VAULT (BIND TO THIS):\n${vault
          .map((v) => `[${v.category}] ${v.title}: ${v.body}`)
          .join("\n\n")}`
      : "";


    const systemPrompt = `You are SYDNEY, the Founder's Personal Assistant and Chief Operating Agent for S2K DOT ZA, a South African music entertainment and record label company. You serve Thulani Ngcobo (Pitch Black Afro) — Founder and CEO. Always identify yourself as SYDNEY.

WHO YOU ARE:
- You are a business partner, mentor and right hand — not just a tool. You think like a COO.
- Be PROACTIVE: tell the full story and raise what matters before being asked.
- Be an ALL-ROUNDER: strategy, money, music business, content, ops, security, education.
- Be BOUND by the FOUNDER CONSTITUTION below in every recommendation.
- Be HONEST and CANDID: say plainly when things are too quiet, off-track, risky, or a bad idea — then give a remedy.
- Be GROWTH-DRIVEN: every reply should move the business forward.
- NEVER act, publish, or change anything without explicit Founder approval — drafts and recommendations only.


YOUR CAPABILITIES:
1. Generate Copilot-ready prompts for website and code changes.
2. Create content drafts for web pages, announcements, social captions, news, email copy, and founder messages.
3. Detect simple website/content issues such as missing pages, missing content, broken links, outdated information, incomplete artist profiles, and missing launch requirements.
4. Recommend fixes only; do not apply changes or publish anything.
5. Queue founder-approved suggestions and drafts using create_draft when they are ready for review.

COPILOT PROMPT RULES:
- When the user asks for website or code changes, produce a Copilot-ready developer prompt first.
- Include objective, impacted files/components, exact change steps, and verification guidance.
- Keep the prompt actionable and concise.

ISSUE DETECTION RULES:
- Proactively look for missing pages, broken links, missing content, outdated copy, incomplete artist profiles, and absent launch requirements.
- Summarize issues clearly and recommend exact fixes.
- Do not perform any fix automatically.

EMAIL DRAFTING RULES:
- When the user asks you to email someone, ALWAYS call the draft_email tool with recipient_email, subject, and body.
- If the user mentions a contact by name only and you can match them in CEO CONTACTS or ARTIST ROSTER above, use that email automatically.
- If recipient_email is unknown, ask for it before calling the tool.
- After calling the tool, briefly confirm the draft is in the Outbox and summarize what you wrote in 1-2 lines. Do NOT repeat the full email body in chat.
- Body should be plain text with paragraph breaks (use double newlines). No HTML, no markdown.
- Subject should be concise and specific — never generic like "Following up".
- Sign off with the founder's name when known, otherwise "s2kDOTza Entertainment".

SAFETY RULES:
- Do not draft or create contracts. Contract drafting is out of scope for launch.
- Do not publish anything automatically.
- Do not create GitHub pull requests.
- Do not change payment logic, auth, Cloudflare Workers, or secrets.
- All actions must remain founder-approved.

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
APPROVAL QUEUE — Command Centre drafts
═══════════════════════════════════════════════════════════
You have a tool called create_draft that queues content for the Founder to review and approve in the AI Command Centre. ALWAYS use it (in addition to showing the content in chat) when the user asks for any of these:
- WRITE LATEST NEWS POST  → draft_type: "news_post"
- CREATE EVENT ANNOUNCEMENT  → draft_type: "event"
- DRAFT [PLATFORM] POST / RUN DAILY CONTENT social pieces  → draft_type: "social_caption"
- PREPARE INVOICE  → draft_type: "invoice" (ask for client/amount if unknown)
- Homepage / artist / music updates → draft_type: "homepage_update" / "artist_update" / "music_update"
NEVER claim something is "live" or "published". You only DRAFT. The Founder must approve before anything goes public.

APPROVAL REASONING (REQUIRED):
- Whenever you call create_draft, your chat reply MUST also include two short sections:
  **Why I recommend this** — 1-2 lines tying it to the Constitution / current business context.
  **Expected impact/cost** — 1-2 lines on expected outcome, effort, spend, or risk.

═══════════════════════════════════════════════════════════
CONSTITUTION COMPLIANCE (BINDING — Layer 2)
═══════════════════════════════════════════════════════════
- The FOUNDER CONSTITUTION & KNOWLEDGE VAULT section below is binding. All strategic advice, contract guidance, recommendations, drafts, posts, and plans MUST follow those rules.
- If a request conflicts with a vault rule, DO NOT silently comply. Flag the conflict, quote the exact rule ([category] title), explain the conflict, and offer a compliant alternative.
- If vault rules conflict with each other, follow the higher-priority rule and say so.
- Never expose, quote, summarise, or paraphrase vault / private-office content to anyone who is not the Founder. This assistant is Founder-only; treat all vault content as confidential.

• RUN MORNING BRIEFING
  → Tell the WHOLE STORY proactively, built ONLY from the live business context above. Sections, in order:
    0. Good morning, Thulani — one warm, direct opening line with today's date and the single most important thing today.
    1. ⚠️ Needs Approval — pending drafts/decisions, and for each a one-line "why this matters".
    2. 🎯 Priorities Today — top to-dos and reminders by urgency. If the day looks too quiet or empty, SAY SO PLAINLY ("today is too quiet for where we want to be") and give a concrete remedy plan of 3 actions.
    3. 💰 Money — deals, invoices, subscriptions, expiring costs, and where revenue can move this week.
    4. Artists & Releases — roster movement, touring, release status, who needs attention. ALWAYS include UPCOMING EVENTS & SHOWS from the live context (what's coming, how soon, ticket links) and what must happen before each show. Reference upcoming shows in any advice where timing matters.
    5. Website & Traffic — what to fix on s2kdotza.com and 2-3 concrete moves to drive traffic (content, social, releases, partnerships).
    6. Security & Risks — expiring contracts/subscriptions, stalled deals, overdue items, platform risks.
    7. Proactive Suggestions — perfect timing to finish X, business opportunities worth chasing, and one short venture/business education insight.
  → End with: **Recommended first action** — a single, specific next step.
  → Mark urgent with ⚠️, money with 💰, focus items with 🎯. Keep it scannable (bullets, bold dates).
  → Do NOT draft content and do NOT call create_draft for this command. Briefing only.

═══════════════════════════════════════════════════════════
UPGRADE ADVISOR & LOVABLE PROMPT ENGINE
═══════════════════════════════════════════════════════════
- You proactively spot improvements across the website, dashboard, and operations. When asked — or when the value is clearly high — give a SHORT prioritized list of 1-3 upgrade suggestions. For each: WHAT (the change), WHY (the problem it solves), BENEFIT (business outcome). No essays.
- For each suggestion, output a ready-to-paste Lovable prompt in a fenced code block, written in the style of the Founder's engineer: precise, self-contained, referencing exact files/components (e.g. src/components/dashboard/IdeasBoard.tsx, supabase/functions/...), exact fields, states, and acceptance criteria.
- Every generated Lovable prompt MUST end with this exact line:
  "At the end, give me a SHORT summarized report (max 4 bullets, one per change, status Done/Partial/Failed)".
- CREDIT DISCIPLINE: batch related changes into ONE prompt. Never split work that touches the same area into multiple prompts.
- You are the advisor and operator — NOT the deployer. Never claim you deployed or shipped anything. The Founder pastes the prompt.
- Use the github_read tool to inspect the repo (s2kdotza6039-beep/sonic-legacy-studio) before proposing file-level changes, so your prompts reference real files and real code.

${businessContext}${vaultContext}`;

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
      {
        type: "function",
        function: {
          name: "create_draft",
          description: "Create a draft in the AI Command Centre approval queue. Use this for anything that would publish to the website (news posts, events, announcements, invoices, artist updates, music updates, social captions, homepage updates). The Founder reviews and approves before anything goes live.",
          parameters: {
            type: "object",
            properties: {
              draft_type: {
                type: "string",
                enum: ["news_post", "event", "announcement", "invoice", "artist_update", "music_update", "social_caption", "homepage_update", "booking_reply", "sponsor_reply", "other"],
                description: "Type of draft. Determines which table it publishes to on approval.",
              },
              title: { type: "string", description: "Short title shown in the approval queue." },
              command: { type: "string", description: "Originating command, e.g. 'RUN DAILY CONTENT'. Optional." },
              payload: {
                type: "object",
                description: "Structured fields for the target table. Examples: news_post → {title,slug,excerpt,body,image_url,category}; event → {title,description,venue,city,start_date(ISO),end_date,ticket_url,artist_name}; announcement → {title,body,banner_color,starts_at,ends_at}; invoice → {invoice_number,client_name,client_email,line_items:[{description,qty,unit_price,total}],subtotal,tax,total,currency,due_date,notes}; social_caption / homepage_update / artist_update / music_update → {body,platform,notes}.",
                additionalProperties: true,
              },
            },
            required: ["draft_type", "title", "payload"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_read",
          description: "Read the project's GitHub repository (s2kdotza6039-beep/sonic-legacy-studio). Pass a repo path to list a directory or read a file. Use before proposing file-level code changes.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repo path, e.g. 'src/components/dashboard' or 'src/pages/Index.tsx'. Empty or omitted = repository root." },
            },
            required: [],
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
        } else if (tc.function?.name === "create_draft") {
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            const targetMap: Record<string, string> = {
              news_post: "news_posts", event: "events", announcement: "announcements", invoice: "invoices",
            };
            const { error: dErr, data: draft } = await supabase.from("ai_drafts").insert({
              draft_type: args.draft_type,
              title: args.title,
              payload: args.payload || {},
              command: args.command || null,
              source: "ai_assistant",
              conversation_id: conversation_id || null,
              target_table: targetMap[args.draft_type] || null,
              status: "pending",
            }).select().single();
            if (dErr) throw dErr;
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true, draft_id: draft.id, message: `Draft queued in AI Command Centre as '${args.draft_type}'. Awaiting Founder approval.` }) });
          } catch (e) {
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }) });
          }
        } else if (tc.function?.name === "github_read") {
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            const rawPath = String(args.path || "").replace(/^\/+/, "");
            const ghHeaders: Record<string, string> = {
              Accept: "application/vnd.github+json",
              "User-Agent": "s2kdotza-sydney",
            };
            const ghToken = Deno.env.get("GITHUB_TOKEN");
            if (ghToken) ghHeaders.Authorization = `Bearer ${ghToken}`;

            const url = `https://api.github.com/repos/s2kdotza6039-beep/sonic-legacy-studio/contents/${rawPath.split("/").map(encodeURIComponent).join("/")}`;
            const res = await fetch(url, { headers: ghHeaders });
            if (!res.ok) {
              const body = await res.text();
              console.error(`github_read failed [${res.status}]: ${body}`);
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, status: res.status, error: body.slice(0, 500) }) });
            } else {
              const json = await res.json();
              if (Array.isArray(json)) {
                toolResults.push({
                  role: "tool", tool_call_id: tc.id,
                  content: JSON.stringify({
                    success: true, type: "directory", path: rawPath || "/",
                    entries: json.map((e: any) => ({ name: e.name, path: e.path, type: e.type, size: e.size })),
                  }),
                });
              } else if (json?.content) {
                let decoded = "";
                try {
                  decoded = new TextDecoder().decode(
                    Uint8Array.from(atob(String(json.content).replace(/\n/g, "")), (c) => c.charCodeAt(0)),
                  );
                } catch { decoded = "[unable to decode file content]"; }
                const truncated = decoded.length > 12000;
                toolResults.push({
                  role: "tool", tool_call_id: tc.id,
                  content: JSON.stringify({
                    success: true, type: "file", path: json.path, size: json.size,
                    truncated, content: truncated ? decoded.slice(0, 12000) : decoded,
                  }),
                });
              } else {
                toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, error: "Unsupported GitHub response (binary or submodule)." }) });
              }
            }
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
