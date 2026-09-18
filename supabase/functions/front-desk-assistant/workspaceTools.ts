// Typed, allowlisted workspace tools for SYDNEY.
// The model NEVER gets raw SQL or arbitrary table names — only these handlers.

type Sb = any;

export interface WorkspaceCtx {
  supabase: Sb;
  founderId: string | null;
  founderEmail: string | null;
  conversationId: string | null;
}

const LOCATIONS: Record<string, string> = {
  contact: "Dashboard → CEO Diary → Contacts",
  note: "Dashboard → Notepad",
  todo: "Dashboard → CEO Diary → To-Do",
  touring: "Dashboard → CEO Diary → Touring",
  subscription: "Dashboard → CEO Diary → Subscriptions",
  memory: "Dashboard → Sydney → Memory",
  email_draft: "Dashboard → CEO Diary → Outbox",
  ai_draft: "Dashboard → Approval Queue",
};

const ENTITY_TABLE: Record<string, string> = {
  contact: "ceo_contacts",
  note: "ceo_notes",
  todo: "ceo_todos",
  touring: "touring_log",
  subscription: "subscriptions",
  reminder: "reminders",
  memory: "sydney_memory",
};

// Actions that confirm_workspace_action is allowed to execute itself.
const EXECUTABLE_KINDS = [
  "send_email_draft",
  "approve_ai_draft",
  "upsert_touring_log",
  "upsert_subscription",
] as const;

const str = (v: unknown, max = 2000) =>
  v === undefined || v === null ? null : String(v).trim().slice(0, max) || null;

const pick = <T extends Record<string, unknown>>(src: Record<string, unknown>, keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out as T;
};

async function audit(
  ctx: WorkspaceCtx,
  row: {
    action: string; entity_type: string; entity_id?: string | null; tier?: number;
    location?: string | null; summary?: string | null;
    before?: unknown; after?: unknown; result?: string;
  },
) {
  await ctx.supabase.from("sydney_action_log").insert({
    actor_role: "sydney",
    founder_user_id: ctx.founderId,
    founder_email: ctx.founderEmail,
    action: row.action,
    tier: row.tier ?? 1,
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? null,
    location: row.location ?? null,
    summary: row.summary ?? null,
    before_snapshot: row.before ?? {},
    after_snapshot: row.after ?? {},
    result: row.result ?? "success",
    conversation_id: ctx.conversationId,
  });
}

export const workspaceToolDefs = [
  {
    type: "function",
    function: {
      name: "search_ceo_workspace",
      description:
        "Search the Founder's private workspace: contacts, notes, todos, touring log, subscriptions, reminders, sydney memory, or recent sydney actions. Use before creating anything so you don't duplicate records.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["contact", "note", "todo", "touring", "subscription", "reminder", "memory", "actions"] },
          query: { type: "string", description: "Optional free-text match." },
          status: { type: "string", description: "Optional status filter (touring/subscription/todo)." },
          from: { type: "string", description: "Optional ISO start date." },
          to: { type: "string", description: "Optional ISO end date." },
          limit: { type: "number" },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ceo_record",
      description: "Read one private workspace record by entity type and id.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["contact", "note", "todo", "touring", "subscription", "reminder", "memory"] },
          id: { type: "string" },
        },
        required: ["entity", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_ceo_contact",
      description:
        "TIER 1 — execute immediately. Create or update a contact in CEO Diary → Contacts. Deduplicates on email. Never deletes.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          role: { type: "string" },
          category: { type: "string", description: "e.g. partner, artist, media, supplier, general" },
          notes: { type: "string" },
          contact_id: { type: "string", description: "Pass to update an existing contact." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_or_update_ceo_note",
      description:
        "TIER 1 — execute immediately. Save a note to Dashboard → Notepad. If no title is given, choose a clear one and report it. Supports append mode.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          note_id: { type: "string" },
          append: { type: "boolean", description: "Append to existing note content instead of replacing." },
          is_pinned: { type: "boolean" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_or_update_ceo_todo",
      description:
        "TIER 1 — execute immediately. Create or update a task in CEO Diary → To-Do. due_date must be resolved to YYYY-MM-DD in Africa/Johannesburg time; report the resolved date.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          due_date: { type: "string", description: "YYYY-MM-DD (Africa/Johannesburg)." },
          category: { type: "string" },
          todo_id: { type: "string" },
          is_done: { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_and_surface",
      description:
        "TIER 1 — save long-term memory AND return its visible location so the Founder can inspect it in Dashboard → Sydney → Memory. If the fact is operational (a contact, task, date, commitment), also write it to the proper workspace section with the right tool.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          category: { type: "string" },
          important: { type: "boolean" },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stage_workspace_action",
      description:
        "TIER 2/3 — prepare an action that needs Founder confirmation (sending email, publishing, touring/subscription/money changes, contracts, anything touching an outside person). Returns an action_id. Then ask the Founder to reply Confirm or Cancel. Never execute before confirmation.",
      parameters: {
        type: "object",
        properties: {
          action_kind: {
            type: "string",
            description:
              "One of: send_email_draft, approve_ai_draft, upsert_touring_log, upsert_subscription (executable by confirm_workspace_action), or another kind for review-only staging.",
          },
          tier: { type: "number", enum: [2, 3] },
          summary: { type: "string", description: "One-line description shown to the Founder." },
          changes: { type: "object", additionalProperties: true, description: "Exact payload. send_email_draft → {draft_id}. approve_ai_draft → {draft_id}. upsert_touring_log → {id?,event_name,artist_name,venue,city,country,start_date,end_date,status,budget,actual_cost,notes}. upsert_subscription → {id?,service_name,description,cost,billing_cycle,start_date,expiry_date,auto_renew,reminder_days,status,category,notes}." },
          target_entity: { type: "string" },
          target_id: { type: "string" },
          risk: { type: "string", description: "Plain-language risk statement." },
        },
        required: ["action_kind", "tier", "summary", "changes", "risk"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_workspace_action",
      description:
        "Execute a previously staged action AFTER the Founder explicitly confirmed it. Requires the exact action_id that was shown to him.",
      parameters: { type: "object", properties: { action_id: { type: "string" } }, required: ["action_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_workspace_action",
      description: "Cancel a staged pending action.",
      parameters: {
        type: "object",
        properties: { action_id: { type: "string" }, reason: { type: "string" } },
        required: ["action_id"],
      },
    },
  },
];

export const WORKSPACE_TOOL_NAMES = workspaceToolDefs.map((t) => t.function.name);

async function executeStaged(ctx: WorkspaceCtx, action: any) {
  const kind = action.action_kind;
  const changes = action.changes || {};
  const sb = ctx.supabase;

  if (kind === "send_email_draft") {
    const draftId = str(changes.draft_id, 60);
    if (!draftId) return { success: false, error: "Missing draft_id." };
    const { data: draft } = await sb.from("email_drafts").select("*").eq("id", draftId).maybeSingle();
    if (!draft) return { success: false, error: "Email draft no longer exists." };
    const messageId = `outbox-${draft.id}`;
    // send-outbox-email records the send outcome and updates the draft itself.
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-outbox-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ draftId: draft.id }),
    });
    const json = await res.json().catch(() => ({}));
    const status = json?.status || (res.ok ? "accepted" : "failed");
    return {
      success: res.ok && status === "accepted",
      status,
      message_id: json?.message_id || messageId,
      note: "Accepted by the mail service — this is NOT confirmed inbox delivery. Check CEO Diary → Outbox / Email Status for the real outcome.",
      location: LOCATIONS.email_draft,
      entity_id: draft.id,
      entity_type: "email_draft",
    };
  }

  if (kind === "approve_ai_draft") {
    const draftId = str(changes.draft_id, 60);
    if (!draftId) return { success: false, error: "Missing draft_id." };
    const { data, error } = await sb.rpc("approve_ai_draft", { _draft_id: draftId });
    if (error) return { success: false, error: error.message };
    return {
      success: true, published_id: data, entity_type: "ai_draft", entity_id: draftId,
      location: LOCATIONS.ai_draft,
      note: "Approved and published. Verify the live site before telling the Founder it is visible.",
    };
  }

  if (kind === "upsert_touring_log" || kind === "upsert_subscription") {
    const table = kind === "upsert_touring_log" ? "touring_log" : "subscriptions";
    const allow = kind === "upsert_touring_log"
      ? ["event_name", "artist_name", "venue", "city", "country", "start_date", "end_date", "status", "budget", "actual_cost", "notes"]
      : ["service_name", "description", "cost", "billing_cycle", "start_date", "expiry_date", "auto_renew", "reminder_days", "status", "category", "notes"];
    const payload = pick(changes, allow);
    let before: unknown = null;
    let row: any;
    if (changes.id) {
      const { data: prev } = await sb.from(table).select("*").eq("id", changes.id).maybeSingle();
      before = prev;
      const { data, error } = await sb.from(table).update(payload).eq("id", changes.id).select().single();
      if (error) return { success: false, error: error.message };
      row = data;
    } else {
      const { data, error } = await sb.from(table).insert(payload).select().single();
      if (error) return { success: false, error: error.message };
      row = data;
    }
    return {
      success: true, entity_type: kind === "upsert_touring_log" ? "touring" : "subscription",
      entity_id: row.id, record: row, before,
      location: kind === "upsert_touring_log" ? LOCATIONS.touring : LOCATIONS.subscription,
    };
  }

  return {
    success: false,
    error: `Action kind '${kind}' is review-only and cannot be executed automatically. Do it in the dashboard, or ask for a developer prompt.`,
  };
}

export async function handleWorkspaceTool(
  name: string,
  args: Record<string, any>,
  ctx: WorkspaceCtx,
): Promise<unknown> {
  const sb = ctx.supabase;

  if (!ctx.founderId && name !== "search_ceo_workspace" && name !== "get_ceo_record") {
    // Service-role invocations (schedulers) may read, but must not write as the Founder.
    if (!["search_ceo_workspace", "get_ceo_record"].includes(name)) {
      return { success: false, error: "No authenticated Founder in this request — private writes are refused." };
    }
  }

  switch (name) {
    case "search_ceo_workspace": {
      const limit = Math.min(Number(args.limit) || 20, 50);
      if (args.entity === "actions") {
        const { data, error } = await sb.from("sydney_action_log")
          .select("id, action, entity_type, entity_id, location, summary, result, created_at")
          .order("created_at", { ascending: false }).limit(limit);
        return error ? { success: false, error: error.message } : { success: true, results: data };
      }
      const table = ENTITY_TABLE[args.entity];
      if (!table) return { success: false, error: "Unknown entity." };
      let q = sb.from(table).select("*").order("created_at", { ascending: false }).limit(limit);
      if (args.status) q = q.eq("status", args.status);
      if (args.from) q = q.gte("created_at", args.from);
      if (args.to) q = q.lte("created_at", args.to);
      const { data, error } = await q;
      if (error) return { success: false, error: error.message };
      const query = str(args.query, 120)?.toLowerCase();
      const results = query
        ? (data || []).filter((r: any) => JSON.stringify(r).toLowerCase().includes(query))
        : data;
      return { success: true, count: results?.length ?? 0, results };
    }

    case "get_ceo_record": {
      const table = ENTITY_TABLE[args.entity];
      if (!table) return { success: false, error: "Unknown entity." };
      const { data, error } = await sb.from(table).select("*").eq("id", args.id).maybeSingle();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: "Record not found." };
      return { success: true, record: data, location: LOCATIONS[args.entity] || null };
    }

    case "upsert_ceo_contact": {
      const fields: Record<string, unknown> = {
        name: str(args.name, 200),
        email: str(args.email, 200)?.toLowerCase() ?? null,
        phone: str(args.phone, 60),
        company: str(args.company, 200),
        role: str(args.role, 120),
        category: str(args.category, 60) || "general",
        notes: str(args.notes, 4000),
      };
      if (!fields.name) return { success: false, error: "A contact name is required." };

      let existing: any = null;
      if (args.contact_id) {
        const { data } = await sb.from("ceo_contacts").select("*").eq("id", args.contact_id).maybeSingle();
        existing = data;
        if (!existing) return { success: false, error: "contact_id not found." };
      } else if (fields.email) {
        const { data } = await sb.from("ceo_contacts").select("*").eq("email", fields.email).maybeSingle();
        existing = data;
      } else {
        const { data } = await sb.from("ceo_contacts").select("*").ilike("name", fields.name as string).limit(1);
        if (data?.length) {
          return {
            success: false,
            needs_clarification: true,
            possible_duplicate: data[0],
            error: `A contact named '${fields.name}' already exists and no email was given. Ask the Founder whether to update that record or create a second one (pass contact_id to update).`,
          };
        }
      }

      let row: any;
      if (existing) {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined) patch[k] = v;
        const { data, error } = await sb.from("ceo_contacts").update(patch).eq("id", existing.id).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      } else {
        const { data, error } = await sb.from("ceo_contacts").insert(fields).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      }
      await audit(ctx, {
        action: existing ? "update_contact" : "create_contact", entity_type: "contact", entity_id: row.id,
        location: LOCATIONS.contact, summary: `${existing ? "Updated" : "Added"} contact ${row.name}`,
        before: existing ?? {}, after: row,
      });
      return { success: true, updated: !!existing, record_id: row.id, record: row, location: LOCATIONS.contact };
    }

    case "create_or_update_ceo_note": {
      const content = str(args.content, 20000);
      if (!content) return { success: false, error: "Note content is required." };
      let existing: any = null;
      if (args.note_id) {
        const { data } = await sb.from("ceo_notes").select("*").eq("id", args.note_id).maybeSingle();
        existing = data;
        if (!existing) return { success: false, error: "note_id not found." };
      }
      const title = str(args.title, 200) || existing?.title || content.split("\n")[0].slice(0, 60) || "Note from Sydney";
      let row: any;
      if (existing) {
        const nextContent = args.append ? `${existing.content || ""}\n\n${content}`.trim() : content;
        const { data, error } = await sb.from("ceo_notes")
          .update({ title, content: nextContent, ...(args.is_pinned !== undefined ? { is_pinned: !!args.is_pinned } : {}) })
          .eq("id", existing.id).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      } else {
        const { data, error } = await sb.from("ceo_notes")
          .insert({ title, content, is_pinned: !!args.is_pinned }).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      }
      await audit(ctx, {
        action: existing ? "update_note" : "create_note", entity_type: "note", entity_id: row.id,
        location: LOCATIONS.note, summary: `${existing ? "Updated" : "Saved"} note "${row.title}"`,
        before: existing ?? {}, after: row,
      });
      return { success: true, updated: !!existing, record_id: row.id, title: row.title, location: LOCATIONS.note };
    }

    case "create_or_update_ceo_todo": {
      const title = str(args.title, 300);
      if (!title) return { success: false, error: "A task title is required." };
      const due = str(args.due_date, 20);
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        return { success: false, error: "due_date must be YYYY-MM-DD (Africa/Johannesburg)." };
      }
      const fields: Record<string, unknown> = {
        title,
        description: str(args.description, 4000),
        priority: ["high", "medium", "low"].includes(args.priority) ? args.priority : "medium",
        due_date: due,
        category: str(args.category, 60) || "general",
      };
      if (args.is_done !== undefined) fields.is_done = !!args.is_done;

      let existing: any = null;
      if (args.todo_id) {
        const { data } = await sb.from("ceo_todos").select("*").eq("id", args.todo_id).maybeSingle();
        existing = data;
        if (!existing) return { success: false, error: "todo_id not found." };
      }
      let row: any;
      if (existing) {
        const { data, error } = await sb.from("ceo_todos").update(fields).eq("id", existing.id).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      } else {
        const { data, error } = await sb.from("ceo_todos").insert(fields).select().single();
        if (error) return { success: false, error: error.message };
        row = data;
      }
      await audit(ctx, {
        action: existing ? "update_todo" : "create_todo", entity_type: "todo", entity_id: row.id,
        location: LOCATIONS.todo, summary: `${existing ? "Updated" : "Added"} task "${row.title}"${row.due_date ? ` due ${row.due_date}` : ""}`,
        before: existing ?? {}, after: row,
      });
      return {
        success: true, updated: !!existing, record_id: row.id, resolved_due_date: row.due_date,
        location: row.due_date ? `${LOCATIONS.todo} (and Calendar)` : LOCATIONS.todo,
      };
    }

    case "remember_and_surface": {
      const key = str(args.key, 120);
      const value = str(args.value, 8000);
      if (!key || !value) return { success: false, error: "key and value are required." };
      const { data, error } = await sb.from("sydney_memory").upsert({
        key, value, category: str(args.category, 60) || "general",
        source: "founder", important: args.important !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" }).select().single();
      if (error) return { success: false, error: error.message };
      await audit(ctx, {
        action: "remember", entity_type: "memory", entity_id: data.id, location: LOCATIONS.memory,
        summary: `Remembered "${key}"`, after: data,
      });
      return {
        success: true, record_id: data.id, key: data.key, location: LOCATIONS.memory,
        reminder: "If this fact is operational (a person, a task, a date, a commitment), also write it to the correct visible section.",
      };
    }

    case "stage_workspace_action": {
      const kind = str(args.action_kind, 60);
      const summary = str(args.summary, 500);
      if (!kind || !summary) return { success: false, error: "action_kind and summary are required." };
      const tier = Number(args.tier) === 3 ? 3 : 2;
      const { data, error } = await sb.from("assistant_pending_actions").insert({
        action_kind: kind,
        tier,
        summary,
        changes: args.changes || {},
        target_entity: str(args.target_entity, 60),
        target_id: str(args.target_id, 120),
        risk: str(args.risk, 1000),
        created_by: ctx.founderId,
        created_by_email: ctx.founderEmail,
        conversation_id: ctx.conversationId,
      }).select().single();
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        action_id: data.id,
        tier,
        executable: (EXECUTABLE_KINDS as readonly string[]).includes(kind),
        expires_at: data.expires_at,
        location: "Dashboard → Sydney → Pending Actions",
        instruction:
          "Show the Founder ACTION / TARGET / CHANGE / RISK and ask him to reply Confirm or Cancel. Do NOT execute until he confirms, then call confirm_workspace_action with this exact action_id.",
      };
    }

    case "confirm_workspace_action": {
      const id = str(args.action_id, 60);
      if (!id) return { success: false, error: "action_id is required." };
      const { data: action } = await sb.from("assistant_pending_actions").select("*").eq("id", id).maybeSingle();
      if (!action) return { success: false, error: "That action_id does not exist." };
      if (action.status !== "pending") return { success: false, error: `Action already ${action.status}.` };
      if (new Date(action.expires_at).getTime() < Date.now()) {
        await sb.from("assistant_pending_actions").update({ status: "expired" }).eq("id", id);
        return { success: false, error: "That action expired. Stage it again." };
      }
      if (!ctx.founderId) return { success: false, error: "No authenticated Founder — refusing to execute." };

      const result = await executeStaged(ctx, action);
      await sb.from("assistant_pending_actions").update({
        status: (result as any).success ? "executed" : "failed",
        executed_at: new Date().toISOString(),
        result,
      }).eq("id", id);
      await audit(ctx, {
        action: `confirmed:${action.action_kind}`,
        tier: action.tier,
        entity_type: (result as any).entity_type || action.target_entity || action.action_kind,
        entity_id: (result as any).entity_id || action.target_id,
        location: (result as any).location || null,
        summary: action.summary,
        before: (result as any).before ?? action.before_snapshot ?? {},
        after: result,
        result: (result as any).success ? "success" : "failed",
      });
      return { ...(result as Record<string, unknown>), action_id: id };
    }

    case "cancel_workspace_action": {
      const id = str(args.action_id, 60);
      if (!id) return { success: false, error: "action_id is required." };
      const { data, error } = await sb.from("assistant_pending_actions")
        .update({ status: "cancelled", result: { reason: str(args.reason, 500) } })
        .eq("id", id).eq("status", "pending").select().maybeSingle();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: "No pending action with that id." };
      await audit(ctx, {
        action: `cancelled:${data.action_kind}`, tier: data.tier, entity_type: "pending_action",
        entity_id: id, summary: `Cancelled: ${data.summary}`, result: "cancelled",
      });
      return { success: true, cancelled: true, action_id: id };
    }
  }

  return { success: false, error: `Unknown workspace tool '${name}'.` };
}
